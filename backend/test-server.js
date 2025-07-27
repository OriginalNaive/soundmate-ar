// 簡化的測試服務器 - 不需要資料庫
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const h3 = require('h3-js');

const app = express();
app.use(cors());
app.use(express.json());

// 模擬資料
const mockData = {
  users: [],
  tracks: [],
  playbacks: [],
  hexes: new Map()
};

// 測試端點
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    data: { 
      message: 'SoundMate AR Test Server is running!',
      version: '1.0.0-test',
      timestamp: new Date().toISOString()
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    data: { 
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: 'mock',
      timestamp: new Date().toISOString()
    }
  });
});

// 位置測試端點
app.post('/api/location/update', (req, res) => {
  const { lat, lng } = req.body;

  if (!lat || !lng || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ 
      success: false, 
      error: { 
        code: 'INVALID_COORDINATES', 
        message: 'Valid latitude and longitude are required' 
      }
    });
  }

  try {
    // 計算 H3 hex
    const hexId = h3.latLngToCell(lat, lng, 9);
    const [centerLat, centerLng] = h3.cellToLatLng(hexId);

    // 儲存到模擬資料
    if (!mockData.hexes.has(hexId)) {
      mockData.hexes.set(hexId, {
        hex_id: hexId,
        center_lat: centerLat,
        center_lng: centerLng,
        total_plays: 0,
        unique_users: 0,
        created_at: new Date()
      });
    }

    res.json({ 
      success: true, 
      data: {
        hex_id: hexId,
        center_lat: centerLat,
        center_lng: centerLng,
        resolution: 9,
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

// 地圖資料測試端點
app.get('/api/map/data', (req, res) => {
  const { lat, lng, zoom = 15 } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ 
      success: false, 
      error: { code: 'MISSING_COORDINATES', message: 'Latitude and longitude are required' }
    });
  }

  try {
    // 生成一些模擬 hex 資料
    const centerHex = h3.latLngToCell(parseFloat(lat), parseFloat(lng), 9);
    const nearbyHexes = h3.gridDisk(centerHex, 2);

    const mockHexes = nearbyHexes.slice(0, 5).map((hexId, index) => {
      const [centerLat, centerLng] = h3.cellToLatLng(hexId);
      return {
        hex_id: hexId,
        center_lat: centerLat,
        center_lng: centerLng,
        total_plays: Math.floor(Math.random() * 100) + 1,
        unique_users: Math.floor(Math.random() * 20) + 1,
        tracked_songs_count: Math.floor(Math.random() * 10) + 1,
        activity_level: index < 2 ? 'high' : index < 4 ? 'medium' : 'low'
      };
    });

    res.json({ 
      success: true, 
      data: {
        hexes: mockHexes,
        tracks: [],
        users_count: Math.floor(Math.random() * 50),
        search_area: {
          center: { lat: parseFloat(lat), lng: parseFloat(lng) },
          center_hex: centerHex,
          zoom_level: parseInt(zoom),
          total_hexes_searched: nearbyHexes.length,
          active_hexes_found: mockHexes.length
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

// Spotify 模擬端點 (用於測試前端)
app.get('/api/auth/spotify/login', (req, res) => {
  if (!process.env.SPOTIFY_CLIENT_ID || process.env.SPOTIFY_CLIENT_ID === 'your_spotify_client_id_here') {
    return res.status(500).json({
      success: false,
      error: { 
        code: 'SPOTIFY_NOT_CONFIGURED',
        message: 'Spotify API credentials not configured. Please check SPOTIFY_SETUP.md',
        help: 'Update SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env file'
      }
    });
  }
  
  res.redirect(`https://accounts.spotify.com/authorize?response_type=code&client_id=${process.env.SPOTIFY_CLIENT_ID}&scope=user-read-currently-playing&redirect_uri=${encodeURIComponent(process.env.SPOTIFY_REDIRECT_URI)}&show_dialog=true`);
});

// 模擬當前播放
app.get('/api/music/current', (req, res) => {
  const mockTrack = {
    spotify_track_id: 'mock_' + Date.now(),
    name: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    duration_ms: 180000,
    image_url: 'https://via.placeholder.com/300x300?text=Album+Cover',
    is_playing: true,
    progress_ms: Math.floor(Math.random() * 180000)
  };

  res.json({ 
    success: true, 
    data: { track: mockTrack },
    timestamp: new Date().toISOString()
  });
});

// 錯誤處理
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: { 
      code: 'NOT_FOUND', 
      message: `Route ${req.method} ${req.originalUrl} not found`,
      available_endpoints: [
        'GET /',
        'GET /health', 
        'POST /api/location/update',
        'GET /api/map/data',
        'GET /api/auth/spotify/login',
        'GET /api/music/current'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🧪 SoundMate AR Test Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🎵 Environment: ${process.env.NODE_ENV || 'test'}`);
  console.log(`🗄️  Database: Mock data (no real database required)`);
  console.log(`🎯 Ready for testing!`);
});