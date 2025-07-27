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

module.exports = router;