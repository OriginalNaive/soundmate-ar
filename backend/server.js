// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// 測試 API
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    data: { 
      message: 'SoundMate AR backend is live',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }
  });
});

// 健康檢查 API
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    data: { 
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    }
  });
});

// 導入路由
const spotifyAuth = require('./routes/spotify');
const musicRoutes = require('./routes/music');
const locationRoute = require('./routes/location');
const mapRoutes = require('./routes/map');

// 設定路由
app.use('/api/auth/spotify', spotifyAuth);
app.use('/api/music', musicRoutes);
app.use('/api/location', locationRoute);
app.use('/api/map', mapRoutes);

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

// 全域錯誤處理
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({ 
    success: false, 
    error: { 
      code: 'INTERNAL_ERROR', 
      message: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    },
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 SoundMate AR Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🎵 Environment: ${process.env.NODE_ENV || 'development'}`);
});
