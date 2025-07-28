const express = require('express');
const router = express.Router();
const h3 = require('h3-js');
const { query } = require('../config/database');
const { validate, schemas } = require('../middleware/validation');
const { hexDataCache } = require('../middleware/cache');

// H3 解析度設定
const H3_RESOLUTION = parseInt(process.env.H3_RESOLUTION) || 9; // 預設使用 resolution 9

// 更新用戶位置並計算 H3 hex
router.post('/update', validate(schemas.locationUpdate), async (req, res) => {
  const { lat, lng } = req.body;

  try {
    const { HexProperty } = require('../models');
    console.log('使用的 HexProperty 模型:', HexProperty.createOrGet.toString().substring(0, 100));
    
    // 計算 H3 hex ID
    const calculatedHexId = h3.latLngToCell(lat, lng, H3_RESOLUTION);
    
    // 獲取 hex 中心點
    const [centerLat, centerLng] = h3.cellToLatLng(calculatedHexId);
    
    // 創建或獲取 hex 屬性
    const hexProperties = await HexProperty.createOrGet(
      calculatedHexId, centerLat, centerLng
    );

    res.json({ 
      success: true, 
      data: {
        hex_id: calculatedHexId,
        center_lat: centerLat,
        center_lng: centerLng,
        resolution: H3_RESOLUTION,
        input_coordinates: { lat, lng }
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Location update error:', err);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'LOCATION_PROCESSING_FAILED', 
        message: 'Failed to process location data',
        details: err.message
      }
    });
  }
});

// 獲取特定 Hex 的資料
router.get('/hex/:hex_id', async (req, res) => {
  const { hex_id } = req.params;

  if (!hex_id) {
    return res.status(400).json({ 
      success: false, 
      error: { code: 'MISSING_HEX_ID', message: 'Hex ID is required' }
    });
  }

  try {
    const { HexProperty } = require('../models');
    const HexTopTrack = require('../models/HexTopTrack');

    // 獲取 hex 屬性
    const hexProperties = await HexProperty.getHexDetails(hex_id);

    if (!hexProperties) {
      return res.status(404).json({ 
        success: false, 
        error: { code: 'HEX_NOT_FOUND', message: 'Hex not found' }
      });
    }

    // 獲取該 hex 的熱門歌曲
    const topTracks = await HexTopTrack.getTopTracks(hex_id, 10);

    res.json({ 
      success: true, 
      data: {
        hex_properties: hexProperties,
        top_tracks: topTracks
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Get hex data error:', err);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'HEX_DATA_FETCH_FAILED', 
        message: 'Failed to fetch hex data',
        details: err.message
      }
    });
  }
});

// 獲取附近的 Hex 資料
router.get('/hex/nearby', async (req, res) => {
  const { lat, lng, radius = 1000 } = req.query;

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

    // 計算當前位置的 hex
    const centerHex = h3.latLngToCell(latitude, longitude, H3_RESOLUTION);
    
    // 獲取周圍的 hex (使用 H3 的 gridDisk 函數)
    const nearbyHexes = h3.gridDisk(centerHex, 2); // 獲取距離 2 的所有 hex

    // 從資料庫查詢這些 hex 的資料
    const { HexProperty } = require('../models');
    const hexesResult = await HexProperty.getHexesByIds(nearbyHexes);

    res.json({ 
      success: true, 
      data: {
        center_hex: centerHex,
        nearby_hexes: hexesResult,
        search_params: {
          lat: latitude,
          lng: longitude,
          radius: searchRadius,
          total_hexes_found: hexesResult.length
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Get nearby hexes error:', err);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'NEARBY_HEXES_FETCH_FAILED', 
        message: 'Failed to fetch nearby hexes',
        details: err.message
      }
    });
  }
});

// 獲取特定 Hex 的熱門歌曲
router.get('/hex/:hex_id/tracks', async (req, res) => {
  const { hex_id } = req.params;
  const { limit = 20, offset = 0 } = req.query;

  try {
    const HexTopTrack = require('../models/HexTopTrack');
    
    const result = await HexTopTrack.getTracksPaginated(
      hex_id, parseInt(limit), parseInt(offset)
    );

    res.json({ 
      success: true, 
      data: {
        tracks: result.tracks,
        total: result.total,
        limit: parseInt(limit),
        offset: parseInt(offset)
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

// H3 工具函數 - 獲取 hex 邊界 (用於地圖渲染)
router.get('/hex/:hex_id/boundary', (req, res) => {
  const { hex_id } = req.params;

  try {
    // 獲取 hex 的邊界座標
    const boundary = h3.cellToBoundary(hex_id);
    
    res.json({ 
      success: true, 
      data: {
        hex_id,
        boundary: boundary.map(([lat, lng]) => ({ lat, lng })),
        center: h3.cellToLatLng(hex_id)
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Get hex boundary error:', err);
    res.status(400).json({ 
      success: false, 
      error: { 
        code: 'INVALID_HEX_ID', 
        message: 'Invalid hex ID provided',
        details: err.message
      }
    });
  }
});

// 向後兼容的舊端點
router.post('/hex', async (req, res) => {
  const { lat, lng } = req.body;
  
  // 重導向到新的端點
  return router.handle({ ...req, body: { lat, lng }, method: 'POST', url: '/update' }, res);
});

module.exports = router;