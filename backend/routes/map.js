const express = require('express');
const router = express.Router();
const h3 = require('h3-js');
const { query } = require('../config/database');

const H3_RESOLUTION = parseInt(process.env.H3_RESOLUTION) || 9;

// 獲取地圖資料 (用於地圖渲染)
router.get('/data', async (req, res) => {
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

    // 獲取有活動的 hex 資料
    const hexesResult = await query(`
      SELECT hp.*, 
             COUNT(htt.id) as tracked_songs_count,
             CASE 
               WHEN hp.total_plays > 50 THEN 'high'
               WHEN hp.total_plays > 10 THEN 'medium'
               ELSE 'low'
             END as activity_level
      FROM hex_properties hp
      LEFT JOIN hex_top_tracks htt ON hp.hex_id = htt.hex_id
      WHERE hp.hex_id = ANY($1::varchar[]) 
        AND hp.total_plays > 0
      GROUP BY hp.hex_id, hp.center_lat, hp.center_lng, hp.resolution, 
               hp.total_plays, hp.unique_users, hp.unique_tracks, 
               hp.last_activity_at, hp.created_at, hp.updated_at
      ORDER BY hp.total_plays DESC
      LIMIT 50
    `, [nearbyHexes]);

    // 獲取這些 hex 中的熱門歌曲
    const topTracksResult = await query(`
      SELECT DISTINCT ON (t.spotify_track_id) 
             t.*, htt.hex_id, htt.play_count, htt.rank_score
      FROM tracks t
      JOIN hex_top_tracks htt ON t.id = htt.track_id
      WHERE htt.hex_id = ANY($1::varchar[])
        AND htt.rank_score > 0
      ORDER BY t.spotify_track_id, htt.rank_score DESC
      LIMIT 100
    `, [nearbyHexes]);

    // 計算活躍用戶數
    const activeUsersResult = await query(`
      SELECT COUNT(DISTINCT up.user_id) as active_users
      FROM user_playback up
      WHERE up.hex_id = ANY($1::varchar[])
        AND up.played_at >= NOW() - INTERVAL '24 hours'
    `, [nearbyHexes]);

    res.json({ 
      success: true, 
      data: {
        hexes: hexesResult.rows,
        tracks: topTracksResult.rows,
        users_count: parseInt(activeUsersResult.rows[0].active_users) || 0,
        search_area: {
          center: { lat: latitude, lng: longitude },
          center_hex: centerHex,
          radius: searchRadius,
          zoom_level: zoomLevel,
          disk_radius: diskRadius,
          total_hexes_searched: nearbyHexes.length,
          active_hexes_found: hexesResult.rows.length
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Get map data error:', err);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'MAP_DATA_FETCH_FAILED', 
        message: 'Failed to fetch map data',
        details: err.message
      }
    });
  }
});

// 獲取地圖邊界內的 hex 資料
router.get('/bounds', async (req, res) => {
  const { north, south, east, west } = req.query;

  if (!north || !south || !east || !west) {
    return res.status(400).json({ 
      success: false, 
      error: { 
        code: 'MISSING_BOUNDS', 
        message: 'Map bounds (north, south, east, west) are required' 
      }
    });
  }

  try {
    const bounds = {
      north: parseFloat(north),
      south: parseFloat(south),
      east: parseFloat(east),
      west: parseFloat(west)
    };

    // 獲取邊界內的 hex 資料
    const hexesResult = await query(`
      SELECT hp.*, 
             COUNT(htt.id) as tracked_songs_count,
             CASE 
               WHEN hp.total_plays > 50 THEN 'high'
               WHEN hp.total_plays > 10 THEN 'medium'
               ELSE 'low'
             END as activity_level
      FROM hex_properties hp
      LEFT JOIN hex_top_tracks htt ON hp.hex_id = htt.hex_id
      WHERE hp.center_lat BETWEEN $1 AND $2
        AND hp.center_lng BETWEEN $3 AND $4
        AND hp.total_plays > 0
      GROUP BY hp.hex_id, hp.center_lat, hp.center_lng, hp.resolution, 
               hp.total_plays, hp.unique_users, hp.unique_tracks, 
               hp.last_activity_at, hp.created_at, hp.updated_at
      ORDER BY hp.total_plays DESC
      LIMIT 100
    `, [bounds.south, bounds.north, bounds.west, bounds.east]);

    res.json({ 
      success: true, 
      data: {
        hexes: hexesResult.rows,
        bounds: bounds,
        total_hexes_found: hexesResult.rows.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Get map bounds data error:', err);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'MAP_BOUNDS_FETCH_FAILED', 
        message: 'Failed to fetch map bounds data',
        details: err.message
      }
    });
  }
});

// 獲取地圖六邊形資料 (前端地圖組件專用)
router.get('/hexagons', async (req, res) => {
  const { north, south, east, west } = req.query;

  if (!north || !south || !east || !west) {
    return res.status(400).json({ 
      success: false, 
      error: { 
        code: 'MISSING_BOUNDS', 
        message: 'Map bounds (north, south, east, west) are required' 
      }
    });
  }

  try {
    const bounds = {
      north: parseFloat(north),
      south: parseFloat(south),
      east: parseFloat(east),
      west: parseFloat(west)
    };

    // 獲取邊界內的 hex 資料，包含音樂特徵和色彩資訊
    const hexesResult = await query(`
      SELECT hp.hex_id,
             hp.center_lat,
             hp.center_lng,
             hp.total_plays,
             hp.unique_users,
             hp.unique_tracks,
             hp.color_hex,
             hp.avg_energy,
             hp.avg_valence,
             hp.avg_danceability,
             hp.last_activity_at,
             CASE 
               WHEN hp.total_plays > 50 THEN 'high'
               WHEN hp.total_plays > 10 THEN 'medium'
               ELSE 'low'
             END as activity_level
      FROM hex_properties hp
      WHERE hp.center_lat BETWEEN $1 AND $2
        AND hp.center_lng BETWEEN $3 AND $4
        AND hp.total_plays > 0
        AND hp.color_hex IS NOT NULL
      ORDER BY hp.total_plays DESC
      LIMIT 50
    `, [bounds.south, bounds.north, bounds.west, bounds.east]);

    res.json({ 
      success: true, 
      data: {
        hexagons: hexesResult.rows,
        bounds: bounds,
        total_hexes_found: hexesResult.rows.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Get map hexagons error:', err);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'MAP_HEXAGONS_FETCH_FAILED', 
        message: 'Failed to fetch map hexagons',
        details: err.message
      }
    });
  }
});

// 獲取單個六邊形的詳細資訊
router.get('/hex/:hex_id', async (req, res) => {
  const { hex_id } = req.params;

  try {
    // 獲取六邊形基本資訊
    const hexResult = await query(`
      SELECT hp.*,
             CASE 
               WHEN hp.total_plays > 50 THEN 'high'
               WHEN hp.total_plays > 10 THEN 'medium'
               ELSE 'low'
             END as activity_level
      FROM hex_properties hp
      WHERE hp.hex_id = $1
    `, [hex_id]);

    if (hexResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: { code: 'HEX_NOT_FOUND', message: 'Hex not found' }
      });
    }

    const hexData = hexResult.rows[0];

    // 獲取熱門歌曲
    const topTracksResult = await query(`
      SELECT t.spotify_track_id as id,
             t.name,
             t.artist,
             t.album,
             t.image_url,
             t.preview_url,
             htt.play_count,
             htt.rank_score
      FROM tracks t
      JOIN hex_top_tracks htt ON t.id = htt.track_id
      WHERE htt.hex_id = $1
      ORDER BY htt.rank_score DESC
      LIMIT 10
    `, [hex_id]);

    // 獲取最近活動
    const recentActivityResult = await query(`
      SELECT COUNT(*) as plays_24h
      FROM user_playback up
      WHERE up.hex_id = $1
        AND up.played_at >= NOW() - INTERVAL '24 hours'
    `, [hex_id]);

    res.json({ 
      success: true, 
      data: {
        hex_info: hexData,
        top_tracks: topTracksResult.rows,
        recent_activity: {
          plays_24h: parseInt(recentActivityResult.rows[0].plays_24h) || 0
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Get hex info error:', err);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'HEX_INFO_FETCH_FAILED', 
        message: 'Failed to fetch hex information',
        details: err.message
      }
    });
  }
});

// 獲取六邊形熱門歌曲 (前端 Modal 專用)
router.get('/hex/:hex_id/tracks', async (req, res) => {
  const { hex_id } = req.params;
  const { limit = 10 } = req.query;

  try {
    const topTracksResult = await query(`
      SELECT t.spotify_track_id as id,
             t.name,
             t.artist,
             t.album,
             t.image_url,
             t.preview_url,
             htt.play_count,
             htt.rank_score,
             htt.last_played_at
      FROM tracks t
      JOIN hex_top_tracks htt ON t.id = htt.track_id
      WHERE htt.hex_id = $1
      ORDER BY htt.rank_score DESC
      LIMIT $2
    `, [hex_id, parseInt(limit)]);

    res.json({ 
      success: true, 
      data: {
        tracks: topTracksResult.rows,
        hex_id: hex_id,
        total_tracks: topTracksResult.rows.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Get hex tracks error:', err);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'HEX_TRACKS_FETCH_FAILED', 
        message: 'Failed to fetch hex tracks',
        details: err.message
      }
    });
  }
});

module.exports = router;