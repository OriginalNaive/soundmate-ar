// SoundMate AR 演示伺服器 - 包含完整功能但使用記憶體資料庫
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { logger } = require('./config/logger');
const MusicFeaturesService = require('./services/musicFeatures');

const app = express();
const PORT = process.env.PORT || 5001;

// 記憶體中的模擬資料庫
const mockData = {
  users: new Map(),
  tracks: new Map(),
  hexProperties: new Map(),
  playbackHistory: []
};

// 基本中介軟體
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:19006'],
  credentials: true
}));

app.use(express.json());

// 健康檢查
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      version: '1.0.0-demo',
      timestamp: new Date().toISOString(),
      database: 'memory (demo mode)',
      features: {
        musicFeatures: true,
        mapVisualization: true,
        h3Integration: true,
        hexAggregation: true
      },
      stats: {
        totalHexes: mockData.hexProperties.size,
        totalTracks: mockData.tracks.size,
        totalPlaybacks: mockData.playbackHistory.length
      }
    }
  });
});

// 根端點
app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'SoundMate AR Demo Server is live',
      version: '1.0.0-demo',
      timestamp: new Date().toISOString(),
      mode: 'demonstration'
    }
  });
});

// 地圖六邊形 API
app.get('/api/map/hexagons', (req, res) => {
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
    const hexagons = generateSmartMockHexagons(
      parseFloat(north),
      parseFloat(south),
      parseFloat(east),
      parseFloat(west)
    );

    // 儲存到記憶體資料庫
    hexagons.forEach(hex => {
      mockData.hexProperties.set(hex.hex_id, hex);
    });

    logger.info(`地圖 API 查詢: ${hexagons.length} 個六邊形`, {
      bounds: { north, south, east, west }
    });

    res.json({
      success: true,
      data: {
        hexagons,
        bounds: { north, south, east, west },
        total_hexes_found: hexagons.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('地圖六邊形查詢失敗:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MAP_HEXAGONS_FETCH_FAILED',
        message: 'Failed to fetch map hexagons',
        details: error.message
      }
    });
  }
});

// 單個六邊形詳細資訊
app.get('/api/map/hex/:hex_id', (req, res) => {
  const { hex_id } = req.params;

  try {
    let hexInfo = mockData.hexProperties.get(hex_id);
    
    if (!hexInfo) {
      // 動態生成六邊形資訊
      hexInfo = generateSingleHexInfo(hex_id);
      mockData.hexProperties.set(hex_id, hexInfo);
    }

    const topTracks = generateConsistentTopTracks(hex_id);
    
    res.json({
      success: true,
      data: {
        hex_info: hexInfo,
        top_tracks: topTracks,
        recent_activity: {
          plays_24h: Math.floor(Math.random() * 50) + 10
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`六邊形 ${hex_id} 資訊獲取失敗:`, error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HEX_INFO_FETCH_FAILED',
        message: 'Failed to fetch hex information'
      }
    });
  }
});

// 六邊形熱門歌曲
app.get('/api/map/hex/:hex_id/tracks', (req, res) => {
  const { hex_id } = req.params;
  const { limit = 10 } = req.query;

  try {
    const tracks = generateConsistentTopTracks(hex_id).slice(0, parseInt(limit));

    res.json({
      success: true,
      data: {
        tracks,
        hex_id,
        total_tracks: tracks.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`六邊形 ${hex_id} 歌曲獲取失敗:`, error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HEX_TRACKS_FETCH_FAILED',
        message: 'Failed to fetch hex tracks'
      }
    });
  }
});

// 音樂特徵測試 API
app.post('/api/test/features', (req, res) => {
  const { features } = req.body;

  if (!features) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_FEATURES', message: 'Features required' }
    });
  }

  try {
    const hsv = MusicFeaturesService.featuresToHSV(features);
    const colorHex = MusicFeaturesService.featuresToColor(features);
    const moodTags = MusicFeaturesService.generateMoodTags(features);

    res.json({
      success: true,
      data: {
        input_features: features,
        hsv_color: hsv,
        hex_color: colorHex,
        mood_tags: moodTags,
        processing_time: '< 1ms'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FEATURE_PROCESSING_FAILED',
        message: error.message
      }
    });
  }
});

// 位置更新 API
app.post('/api/location/update', (req, res) => {
  const { lat, lng } = req.body;

  if (!lat || !lng) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_COORDINATES',
        message: 'Latitude and longitude are required'
      }
    });
  }

  try {
    // 生成 H3 hex_id (模擬)
    const hex_id = `demo_location_${Math.floor(lat * 10000)}_${Math.floor(lng * 10000)}`;
    
    res.json({
      success: true,
      data: {
        hex_id,
        coordinates: { lat, lng },
        message: 'Location updated successfully (demo mode)'
      },
      timestamp: new Date().toISOString()
    });

    logger.info('位置更新成功', { lat, lng, hex_id });
  } catch (error) {
    logger.error('位置更新失敗:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOCATION_UPDATE_FAILED',
        message: 'Failed to update location'
      }
    });
  }
});

// 播放記錄 API
app.post('/api/music/playback', (req, res) => {
  const { track_data, location, hex_id } = req.body;

  if (!track_data || !location || !hex_id) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PLAYBACK_DATA',
        message: 'Track data, location, and hex_id are required'
      }
    });
  }

  try {
    // 模擬儲存播放記錄
    const playbackRecord = {
      id: `playback_${Date.now()}`,
      track_data,
      location,
      hex_id,
      played_at: new Date().toISOString()
    };

    mockData.playbackHistory.push(playbackRecord);

    // 更新該六邊形的統計資料
    let hexInfo = mockData.hexProperties.get(hex_id);
    if (hexInfo) {
      hexInfo.total_plays = (hexInfo.total_plays || 0) + 1;
      mockData.hexProperties.set(hex_id, hexInfo);
    }

    res.json({
      success: true,
      data: {
        playback_id: playbackRecord.id,
        message: 'Playback recorded successfully (demo mode)'
      },
      timestamp: new Date().toISOString()
    });

    logger.info('播放記錄已儲存', { track: track_data.name, hex_id });
  } catch (error) {
    logger.error('播放記錄失敗:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PLAYBACK_RECORD_FAILED',
        message: 'Failed to record playback'
      }
    });
  }
});

// 統計資訊 API
app.get('/api/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      total_hexagons: mockData.hexProperties.size,
      total_tracks: mockData.tracks.size,
      total_playbacks: mockData.playbackHistory.length,
      active_hexagons: Array.from(mockData.hexProperties.values()).filter(h => h.total_plays > 0).length,
      color_distribution: getColorDistribution(),
      top_mood_tags: getTopMoodTags()
    },
    timestamp: new Date().toISOString()
  });
});

// 智慧模擬資料生成函數
function generateSmartMockHexagons(north, south, east, west) {
  const hexagons = [];
  const numHexes = 15;
  
  // 創建多樣化的音樂區域
  const musicAreas = [
    { type: 'electronic', center: { lat: (north + south) / 2, lng: (east + west) / 2 }, radius: 0.002 },
    { type: 'chill', center: { lat: north - 0.001, lng: west + 0.001 }, radius: 0.0015 },
    { type: 'rock', center: { lat: south + 0.001, lng: east - 0.001 }, radius: 0.0015 },
    { type: 'jazz', center: { lat: (north + south) / 2, lng: west + 0.001 }, radius: 0.001 }
  ];

  for (let i = 0; i < numHexes; i++) {
    const area = musicAreas[i % musicAreas.length];
    
    // 在音樂區域附近生成位置
    const lat = area.center.lat + (Math.random() - 0.5) * area.radius * 2;
    const lng = area.center.lng + (Math.random() - 0.5) * area.radius * 2;
    
    // 確保在邊界內
    const clampedLat = Math.max(south, Math.min(north, lat));
    const clampedLng = Math.max(west, Math.min(east, lng));

    // 根據音樂類型生成特徵
    const features = generateMusicAreaFeatures(area.type);
    const colorHex = MusicFeaturesService.featuresToColor(features);
    const moodTags = MusicFeaturesService.generateMoodTags(features);
    
    const hexId = `demo_hex_${area.type}_${i}_${Date.now()}`;

    hexagons.push({
      hex_id: hexId,
      center_lat: clampedLat,
      center_lng: clampedLng,
      color_hex: colorHex,
      total_plays: Math.floor(Math.random() * 80) + 20,
      unique_users: Math.floor(Math.random() * 15) + 5,
      unique_tracks: Math.floor(Math.random() * 25) + 10,
      avg_energy: features.energy,
      avg_valence: features.valence,
      avg_danceability: features.danceability,
      avg_acousticness: features.acousticness,
      activity_level: features.energy > 0.7 ? 'high' : features.energy > 0.4 ? 'medium' : 'low',
      music_area_type: area.type,
      mood_tags: moodTags
    });
  }

  return hexagons;
}

function generateMusicAreaFeatures(areaType) {
  const baseFeatures = {
    electronic: { energy: 0.8, valence: 0.7, danceability: 0.9, acousticness: 0.1 },
    chill: { energy: 0.3, valence: 0.4, danceability: 0.4, acousticness: 0.8 },
    rock: { energy: 0.85, valence: 0.6, danceability: 0.7, acousticness: 0.15 },
    jazz: { energy: 0.5, valence: 0.6, danceability: 0.6, acousticness: 0.4 }
  };

  const base = baseFeatures[areaType] || baseFeatures.electronic;
  
  // 添加一些隨機變化
  return {
    energy: Math.max(0, Math.min(1, base.energy + (Math.random() - 0.5) * 0.3)),
    valence: Math.max(0, Math.min(1, base.valence + (Math.random() - 0.5) * 0.3)),
    danceability: Math.max(0, Math.min(1, base.danceability + (Math.random() - 0.5) * 0.3)),
    acousticness: Math.max(0, Math.min(1, base.acousticness + (Math.random() - 0.5) * 0.3)),
    instrumentalness: Math.random() * 0.3
  };
}

function generateSingleHexInfo(hexId) {
  const areaType = hexId.includes('electronic') ? 'electronic' :
                  hexId.includes('chill') ? 'chill' :
                  hexId.includes('rock') ? 'rock' : 'jazz';
                  
  const features = generateMusicAreaFeatures(areaType);
  
  return {
    hex_id: hexId,
    center_lat: 25.0330 + (Math.random() - 0.5) * 0.01,
    center_lng: 121.5654 + (Math.random() - 0.5) * 0.01,
    total_plays: Math.floor(Math.random() * 100) + 20,
    unique_users: Math.floor(Math.random() * 25) + 5,
    unique_tracks: Math.floor(Math.random() * 40) + 15,
    color_hex: MusicFeaturesService.featuresToColor(features),
    avg_energy: features.energy,
    avg_valence: features.valence,
    avg_danceability: features.danceability,
    activity_level: features.energy > 0.7 ? 'high' : features.energy > 0.4 ? 'medium' : 'low'
  };
}

function generateConsistentTopTracks(hexId) {
  const trackDatabase = [
    // Electronic tracks
    { id: 'e1', name: 'Strobe', artist: 'Deadmau5', album: 'For Lack of a Better Name', category: 'electronic' },
    { id: 'e2', name: 'Levels', artist: 'Avicii', album: 'Levels', category: 'electronic' },
    { id: 'e3', name: 'Animals', artist: 'Martin Garrix', album: 'Animals', category: 'electronic' },
    
    // Chill tracks
    { id: 'c1', name: 'Holocene', artist: 'Bon Iver', album: 'Bon Iver', category: 'chill' },
    { id: 'c2', name: 'Mad World', artist: 'Gary Jules', album: 'Trading Snakeoil for Wolftickets', category: 'chill' },
    { id: 'c3', name: 'The Night We Met', artist: 'Lord Huron', album: 'Strange Trails', category: 'chill' },
    
    // Rock tracks
    { id: 'r1', name: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', category: 'rock' },
    { id: 'r2', name: 'Stairway to Heaven', artist: 'Led Zeppelin', album: 'Led Zeppelin IV', category: 'rock' },
    { id: 'r3', name: 'Sweet Child O\' Mine', artist: 'Guns N\' Roses', album: 'Appetite for Destruction', category: 'rock' },
    
    // Jazz tracks
    { id: 'j1', name: 'Take Five', artist: 'Dave Brubeck', album: 'Time Out', category: 'jazz' },
    { id: 'j2', name: 'So What', artist: 'Miles Davis', album: 'Kind of Blue', category: 'jazz' },
    { id: 'j3', name: 'A Love Supreme', artist: 'John Coltrane', album: 'A Love Supreme', category: 'jazz' }
  ];

  // 根據 hexId 決定音樂類型
  const category = hexId.includes('electronic') ? 'electronic' :
                  hexId.includes('chill') ? 'chill' :
                  hexId.includes('rock') ? 'rock' : 'jazz';

  const categoryTracks = trackDatabase.filter(track => track.category === category);
  
  return categoryTracks.map(track => ({
    ...track,
    play_count: Math.floor(Math.random() * 40) + 10,
    rank_score: Math.random() * 100,
    last_played_at: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString()
  }));
}

function getColorDistribution() {
  const hexes = Array.from(mockData.hexProperties.values());
  const distribution = {};
  
  hexes.forEach(hex => {
    const hue = hex.color_hex;
    if (hue) {
      const category = getColorCategory(hue);
      distribution[category] = (distribution[category] || 0) + 1;
    }
  });
  
  return distribution;
}

function getColorCategory(hexColor) {
  // 簡單的色彩分類
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  if (r > g && r > b) return 'reds';
  if (g > r && g > b) return 'greens';
  if (b > r && b > g) return 'blues';
  return 'others';
}

function getTopMoodTags() {
  const hexes = Array.from(mockData.hexProperties.values());
  const tagCounts = {};
  
  hexes.forEach(hex => {
    if (hex.mood_tags) {
      hex.mood_tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }
  });
  
  return Object.entries(tagCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));
}

// 404 處理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`
    },
    timestamp: new Date().toISOString()
  });
});

// 啟動伺服器
app.listen(PORT, () => {
  logger.info('SoundMate AR 演示伺服器啟動', {
    port: PORT,
    mode: 'demonstration',
    healthCheck: `http://localhost:${PORT}/health`,
    mapAPI: `http://localhost:${PORT}/api/map/hexagons?north=25.04&south=25.02&east=121.58&west=121.55`,
    stats: `http://localhost:${PORT}/api/stats`
  });
  
  console.log(`🚀 SoundMate AR Demo Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🗺️ Map API: http://localhost:${PORT}/api/map/hexagons?north=25.04&south=25.02&east=121.58&west=121.55`);
  console.log(`📈 Statistics: http://localhost:${PORT}/api/stats`);
  console.log(`🎵 Test Features: POST http://localhost:${PORT}/api/test/features`);
});