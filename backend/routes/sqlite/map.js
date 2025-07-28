const express = require('express');
const router = express.Router();
const h3 = require('h3-js');
const { query } = require('../../config/database');
const { mapDataCache, hexDataCache } = require('../../middleware/cache');

const H3_RESOLUTION = parseInt(process.env.H3_RESOLUTION) || 9;

// 獲取地圖資料 (用於地圖渲染) - SQLite 版本
router.get('/data', mapDataCache, async (req, res) => {
  const { lat, lng, zoom, radius = 2000 } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ 
      success: false, 
      error: { code: 'MISSING_COORDINATES', message: 'Latitude and longitude are required' }
    });
  }

  try {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const searchRadius = parseInt(radius);
    const zoomLevel = parseInt(zoom) || 15;

    // 計算當前位置的 hex
    const centerHex = h3.latLngToCell(latitude, longitude, H3_RESOLUTION);
    
    // 根據 zoom level 決定搜索範圍
    let diskRadius = 1;
    if (zoomLevel <= 10) diskRadius = 3;
    else if (zoomLevel <= 13) diskRadius = 2;
    else diskRadius = 1;

    // 獲取周圍的 hex
    const nearbyHexes = h3.gridDisk(centerHex, diskRadius);

    // 為 SQLite 創建 IN 條件
    const placeholders = nearbyHexes.map(() => '?').join(',');
    
    // 獲取有活動的 hex 資料
    const hexesResult = await query(`
      SELECT hp.*, 
             (SELECT COUNT(*) FROM hex_top_tracks htt WHERE htt.hex_id = hp.hex_id) as tracked_songs_count,
             CASE 
               WHEN hp.total_plays > 50 THEN 'high'
               WHEN hp.total_plays > 10 THEN 'medium'
               ELSE 'low'
             END as activity_level
      FROM hex_properties hp
      WHERE hp.hex_id IN (${placeholders}) 
        AND hp.total_plays > 0
      ORDER BY hp.total_plays DESC
    `, nearbyHexes);

    // 為每個 hex 獲取熱門歌曲
    const hexagonsWithSongs = [];
    
    for (const hex of hexesResult.rows) {
      const songsResult = await query(`
        SELECT htt.track_name, htt.artist_name, htt.play_count
        FROM hex_top_tracks htt
        WHERE htt.hex_id = ?
        ORDER BY htt.play_count DESC
        LIMIT 3
      `, [hex.hex_id]);

      // 計算六邊形邊界
      const boundary = h3.cellToBoundary(hex.hex_id, true);
      
      hexagonsWithSongs.push({
        hex_id: hex.hex_id,
        center_lat: parseFloat(hex.center_lat),
        center_lng: parseFloat(hex.center_lng),
        total_plays: hex.total_plays,
        unique_users: hex.unique_users,
        unique_tracks: hex.unique_tracks,
        activity_level: hex.activity_level,
        color_hex: hex.color_hex || '#1DB954',
        avg_energy: hex.avg_energy ? parseFloat(hex.avg_energy) : null,
        avg_valence: hex.avg_valence ? parseFloat(hex.avg_valence) : null,
        avg_danceability: hex.avg_danceability ? parseFloat(hex.avg_danceability) : null,
        boundary: boundary,
        top_tracks: songsResult.rows || []
      });
    }

    res.json({
      success: true,
      data: {
        center: { lat: latitude, lng: longitude },
        zoom: zoomLevel,
        radius: searchRadius,
        hexagons: hexagonsWithSongs,
        total_hexagons: hexagonsWithSongs.length,
        search_hexes: nearbyHexes.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('地圖資料獲取失敗:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MAP_DATA_FETCH_FAILED',
        message: 'Failed to fetch map data',
        details: error.message
      }
    });
  }
});

// 獲取地圖邊界資料
router.get('/bounds', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        MIN(center_lat) as min_lat,
        MAX(center_lat) as max_lat,
        MIN(center_lng) as min_lng,
        MAX(center_lng) as max_lng,
        COUNT(*) as total_hexes
      FROM hex_properties 
      WHERE total_plays > 0
    `);

    const bounds = result.rows[0];
    
    res.json({
      success: true,
      data: {
        bounds: {
          north: parseFloat(bounds.max_lat),
          south: parseFloat(bounds.min_lat),
          east: parseFloat(bounds.max_lng),
          west: parseFloat(bounds.min_lng)
        },
        center: {
          lat: (parseFloat(bounds.max_lat) + parseFloat(bounds.min_lat)) / 2,
          lng: (parseFloat(bounds.max_lng) + parseFloat(bounds.min_lng)) / 2
        },
        total_hexes: bounds.total_hexes
      }
    });
  } catch (error) {
    console.error('地圖邊界獲取失敗:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MAP_BOUNDS_FETCH_FAILED',
        message: 'Failed to fetch map bounds',
        details: error.message
      }
    });
  }
});

// 獲取特定 hex 的詳細資訊
router.get('/hex/:hex_id', hexDataCache, async (req, res) => {
  const { hex_id } = req.params;

  try {
    // 獲取 hex 基本資訊
    const hexResult = await query(
      'SELECT * FROM hex_properties WHERE hex_id = ?',
      [hex_id]
    );

    if (hexResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'HEX_NOT_FOUND', message: 'Hex not found' }
      });
    }

    const hex = hexResult.rows[0];

    // 獲取熱門歌曲
    const songsResult = await query(`
      SELECT htt.track_name, htt.artist_name, htt.play_count, htt.last_played
      FROM hex_top_tracks htt
      WHERE htt.hex_id = ?
      ORDER BY htt.play_count DESC
      LIMIT 10
    `, [hex_id]);

    // 獲取最近播放記錄
    const recentResult = await query(`
      SELECT up.track_name, up.artist_name, up.played_at, up.user_id
      FROM user_playback up
      WHERE up.hex_id = ?
      ORDER BY up.played_at DESC
      LIMIT 10
    `, [hex_id]);

    // 計算六邊形邊界
    const boundary = h3.cellToBoundary(hex_id, true);

    res.json({
      success: true,
      data: {
        hex_id: hex.hex_id,
        center: {
          lat: parseFloat(hex.center_lat),
          lng: parseFloat(hex.center_lng)
        },
        boundary: boundary,
        stats: {
          total_plays: hex.total_plays,
          unique_users: hex.unique_users,
          unique_tracks: hex.unique_tracks
        },
        music_features: {
          avg_energy: hex.avg_energy ? parseFloat(hex.avg_energy) : null,
          avg_valence: hex.avg_valence ? parseFloat(hex.avg_valence) : null,
          avg_danceability: hex.avg_danceability ? parseFloat(hex.avg_danceability) : null,
          avg_tempo: hex.avg_tempo ? parseFloat(hex.avg_tempo) : null
        },
        color_hex: hex.color_hex || '#1DB954',
        top_tracks: songsResult.rows,
        recent_plays: recentResult.rows,
        last_updated: hex.last_updated
      }
    });

  } catch (error) {
    console.error('Hex 詳細資訊獲取失敗:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HEX_DETAIL_FETCH_FAILED',
        message: 'Failed to fetch hex details',
        details: error.message
      }
    });
  }
});

module.exports = router;