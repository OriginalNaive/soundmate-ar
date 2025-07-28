// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { logger, httpLogger, errorLogger, appLogger } = require('./config/logger');
const { 
  generalLimit, 
  strictLimit, 
  playbackLimit, 
  locationLimit,
  speedLimiter,
  helmetConfig,
  createSizeLimit,
  userAgentCheck
} = require('./middleware/security');

const app = express();

// 安全中介軟體
app.use(helmetConfig);
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8081'],
  credentials: true
}));

// 信任代理 (用於正確獲取客戶端 IP)
app.set('trust proxy', 1);

// 請求大小限制
app.use(createSizeLimit('5mb'));

// 用戶代理檢查
app.use(userAgentCheck);

// 一般速率限制
app.use(generalLimit);

// 慢速下降
app.use(speedLimiter);

// 解析 JSON (有大小限制)
app.use(express.json({ limit: '5mb' }));

// HTTP 請求日誌
app.use(httpLogger);

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
app.get('/health', async (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  };

  try {
    // 檢查資料庫連線
    const { query } = require('./config/database');
    const dbStart = Date.now();
    await query('SELECT 1');
    const dbDuration = Date.now() - dbStart;
    
    healthCheck.database = {
      status: 'connected',
      responseTime: `${dbDuration}ms`
    };
  } catch (error) {
    healthCheck.database = {
      status: 'disconnected',
      error: error.message
    };
  }

  // 記憶體使用情況
  const memory = process.memoryUsage();
  healthCheck.memory = {
    rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
    external: `${Math.round(memory.external / 1024 / 1024)}MB`
  };

  // CPU 使用情況
  const usage = process.cpuUsage();
  healthCheck.cpu = {
    user: usage.user,
    system: usage.system
  };

  // 整體狀態判斷
  const isHealthy = healthCheck.database.status === 'connected' && 
                   healthCheck.uptime > 0 &&
                   memory.heapUsed < memory.heapTotal * 0.9; // 記憶體使用低於 90%

  const statusCode = isHealthy ? 200 : 503;
  healthCheck.status = isHealthy ? 'healthy' : 'unhealthy';

  logger.debug('健康檢查執行', healthCheck);

  res.status(statusCode).json({ 
    success: isHealthy, 
    data: healthCheck
  });
});

// 導入路由 - 根據資料庫類型選擇
const dbType = process.env.DB_TYPE || 'postgresql';
const spotifyAuth = require('./routes/spotify');
const musicRoutes = require('./routes/music');
const locationRoute = require('./routes/location');

// 根據資料庫類型選擇地圖路由
const mapRoutes = dbType === 'sqlite' 
  ? require('./routes/sqlite/map')
  : require('./routes/map');

// 設定路由 (套用特定速率限制)
app.use('/api/auth/spotify', strictLimit, spotifyAuth);
app.use('/api/music', playbackLimit, musicRoutes);
app.use('/api/location', locationLimit, locationRoute);
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

// 錯誤日誌中介軟體
app.use(errorLogger);

// 全域錯誤處理
app.use((err, req, res, next) => {
  // 日誌已在 errorLogger 中記錄
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
  logger.info('伺服器啟動', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    healthCheck: `http://localhost:${PORT}/health`,
    timestamp: new Date().toISOString()
  });
  
  appLogger.system('SERVER_STARTED', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
  
  // 啟動 Hex 聚合服務
  const hexAggregationService = require('./services/hexAggregationService');
  hexAggregationService.start();
  logger.info('Hex 聚合服務已啟動');
  
  // 定期記錄記憶體使用情況 (每 5 分鐘)
  if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
      const { performanceLogger } = require('./config/logger');
      performanceLogger.memory();
    }, 5 * 60 * 1000);
  }
  
  // 優雅關閉處理
  process.on('SIGTERM', () => {
    logger.info('收到 SIGTERM 信號，正在優雅關閉伺服器...');
    hexAggregationService.stop();
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    logger.info('收到 SIGINT 信號，正在優雅關閉伺服器...');
    hexAggregationService.stop();
    process.exit(0);
  });
});
