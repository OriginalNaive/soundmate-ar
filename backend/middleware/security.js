const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');

// 基本速率限制設定
const createRateLimit = (windowMs, max, message, skipSuccessfulRequests = false) => {
  return rateLimit({
    windowMs, // 時間窗口
    max, // 最大請求數
    skipSuccessfulRequests,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: message || '請求次數過多，請稍後再試',
        retry_after: Math.ceil(windowMs / 1000)
      },
      timestamp: new Date().toISOString()
    },
    standardHeaders: true, // 回傳 rate limit 資訊在 `RateLimit-*` headers
    legacyHeaders: false // 停用 `X-RateLimit-*` headers
  });
};

// 一般 API 速率限制 (每分鐘 60 次請求)
const generalLimit = createRateLimit(
  1 * 60 * 1000, // 1 分鐘
  60, // 60 次請求
  '一般 API 請求次數過多，每分鐘最多 60 次請求'
);

// 嚴格的速率限制 (用於認證相關端點，每分鐘 5 次)
const strictLimit = createRateLimit(
  1 * 60 * 1000, // 1 分鐘
  5, // 5 次請求
  '認證相關請求次數過多，每分鐘最多 5 次請求',
  true // 跳過成功的請求計數
);

// 播放記錄速率限制 (每分鐘 30 次，防止垃圾資料)
const playbackLimit = createRateLimit(
  1 * 60 * 1000, // 1 分鐘
  30, // 30 次請求
  '播放記錄請求次數過多，每分鐘最多 30 次請求'
);

// 位置更新速率限制 (每分鐘 20 次)
const locationLimit = createRateLimit(
  1 * 60 * 1000, // 1 分鐘
  20, // 20 次請求
  '位置更新請求次數過多，每分鐘最多 20 次請求'
);

// 慢速下降中介軟體 (逐漸增加回應時間)
const speedLimiter = slowDown({
  windowMs: 1 * 60 * 1000, // 1 分鐘
  delayAfter: 30, // 前 30 次請求正常速度
  delayMs: () => 500, // 每次額外請求增加 500ms 延遲
  maxDelayMs: 5000, // 最大延遲 5 秒
  skipFailedRequests: true, // 跳過失敗的請求
  validate: { delayMs: false } // 停用警告
});

// Helmet 安全設定
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.spotify.com", "https://accounts.spotify.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// IP 白名單中介軟體 (開發環境用)
const createIPWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
      return next(); // 開發環境跳過檢查
    }

    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    if (allowedIPs.length === 0 || allowedIPs.includes(clientIP)) {
      return next();
    }

    res.status(403).json({
      success: false,
      error: {
        code: 'IP_NOT_ALLOWED',
        message: '存取被拒絕'
      },
      timestamp: new Date().toISOString()
    });
  };
};

// 請求大小限制中介軟體
const createSizeLimit = (limit = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.get('Content-Length') || 0);
    const maxSize = typeof limit === 'string' ? 
      parseInt(limit) * (limit.includes('mb') ? 1024 * 1024 : 1024) : limit;

    if (contentLength > maxSize) {
      return res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: '請求內容過大',
          max_size: limit
        },
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

// 用戶代理檢查中介軟體 (防止機器人)
const userAgentCheck = (req, res, next) => {
  const userAgent = req.get('User-Agent');
  
  if (!userAgent) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_USER_AGENT',
        message: '缺少 User-Agent header'
      },
      timestamp: new Date().toISOString()
    });
  }

  // 簡單的機器人檢測 (可以根據需要擴展)
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i
  ];

  const isBot = botPatterns.some(pattern => pattern.test(userAgent));
  
  if (isBot && process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'BOT_ACCESS_DENIED',
        message: '機器人存取被拒絕'
      },
      timestamp: new Date().toISOString()
    });
  }

  next();
};

module.exports = {
  // 速率限制
  generalLimit,
  strictLimit,
  playbackLimit,
  locationLimit,
  speedLimiter,
  
  // 安全設定
  helmetConfig,
  
  // 自訂中介軟體
  createRateLimit,
  createIPWhitelist,
  createSizeLimit,
  userAgentCheck
};