const cacheService = require('../services/cacheService');
const { logger } = require('../config/logger');

/**
 * HTTP 響應緩存中介軟體
 * @param {number} ttl - 緩存過期時間（毫秒）
 * @param {Function} keyGenerator - 自定義鍵生成函數
 */
const cacheMiddleware = (ttl = 300000, keyGenerator = null) => {
  return async (req, res, next) => {
    // 只對 GET 請求進行緩存
    if (req.method !== 'GET') {
      return next();
    }

    // 生成緩存鍵
    const cacheKey = keyGenerator 
      ? keyGenerator(req) 
      : `${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`;

    try {
      // 嘗試從緩存獲取響應
      const cachedResponse = cacheService.get(cacheKey);
      
      if (cachedResponse) {
        logger.debug('返回緩存響應', { 
          cacheKey,
          path: req.path,
          method: req.method 
        });
        
        // 設置緩存標頭
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        
        return res.status(cachedResponse.status).json(cachedResponse.data);
      }

      // 攔截原始 res.json 方法
      const originalJson = res.json;
      res.json = function(data) {
        // 只緩存成功的響應
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const responseData = {
            status: res.statusCode,
            data: data
          };
          
          cacheService.set(cacheKey, responseData, ttl);
          
          logger.debug('響應已緩存', { 
            cacheKey,
            status: res.statusCode,
            path: req.path,
            ttl 
          });
        }

        // 設置緩存標頭
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Key', cacheKey);
        
        // 調用原始方法
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('緩存中介軟體錯誤', { 
        error: error.message,
        cacheKey,
        path: req.path 
      });
      next();
    }
  };
};

/**
 * 地圖數據專用緩存中介軟體
 */
const mapDataCache = cacheMiddleware(600000, (req) => {
  // 為地圖數據創建特殊的緩存鍵
  const { bounds, zoom } = req.query;
  return `map:${bounds}:${zoom || 'default'}`;
});

/**
 * 音樂特徵緩存中介軟體
 */
const musicFeatureCache = cacheMiddleware(1800000, (req) => {
  // 音樂特徵緩存30分鐘
  const { trackId } = req.params;
  return `music:features:${trackId}`;
});

/**
 * 用戶播放歷史緩存中介軟體
 */
const playbackHistoryCache = cacheMiddleware(60000, (req) => {
  // 播放歷史緩存1分鐘
  const { userId } = req.params;
  const { limit, offset } = req.query;
  return `playback:history:${userId}:${limit || 20}:${offset || 0}`;
});

/**
 * Hex 區域數據緩存中介軟體
 */
const hexDataCache = cacheMiddleware(300000, (req) => {
  // Hex 數據緩存5分鐘
  const { hexId } = req.params;
  return `hex:data:${hexId}`;
});

/**
 * 手動清除特定緩存
 */
const clearCache = (pattern) => {
  return (req, res, next) => {
    if (pattern) {
      // 這裡可以實現模式匹配清除
      logger.info('手動清除緩存', { pattern });
    } else {
      cacheService.clear();
      logger.info('清除所有緩存');
    }
    next();
  };
};

module.exports = {
  cacheMiddleware,
  mapDataCache,
  musicFeatureCache,
  playbackHistoryCache,
  hexDataCache,
  clearCache
};