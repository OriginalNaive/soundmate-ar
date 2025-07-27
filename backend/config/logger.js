const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// 創建 logs 目錄
const logsDir = path.join(__dirname, '..', 'logs');

// 自訂日誌格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // 如果有額外的 metadata，加入日誌
    if (Object.keys(meta).length > 0) {
      log += ` | ${JSON.stringify(meta)}`;
    }
    
    // 如果有錯誤堆疊，加入日誌
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// 日誌等級顏色設定
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

winston.addColors(logColors);

// 建立 Winston Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'soundmate-ar-backend',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    // 錯誤日誌 - 每日輪轉
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    }),

    // 所有日誌 - 每日輪轉
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d',
      zippedArchive: true
    }),

    // HTTP 請求日誌
    new DailyRotateFile({
      filename: path.join(logsDir, 'http-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'http',
      maxSize: '20m',
      maxFiles: '3d',
      zippedArchive: true
    })
  ],
  
  // 未捕獲的異常處理
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ],
  
  // 未處理的 Promise 拒絕
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ]
});

// 開發環境：加入控制台輸出
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// 建立日誌中介軟體 (用於記錄 HTTP 請求)
const httpLogger = (req, res, next) => {
  const start = Date.now();
  
  // 記錄請求開始
  logger.http('HTTP Request Started', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  });

  // 攔截回應結束事件
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    
    logger.http('HTTP Request Completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      contentLength: res.get('Content-Length') || 0
    });
    
    originalSend.call(this, data);
  };

  next();
};

// 錯誤日誌中介軟體
const errorLogger = (err, req, res, next) => {
  logger.error('Unhandled Error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    query: req.query,
    params: req.params
  });
  
  next(err);
};

// 效能監控日誌
const performanceLogger = {
  // 記錄資料庫查詢效能
  dbQuery: (query, duration, results) => {
    const level = duration > 1000 ? 'warn' : 'debug';
    logger.log(level, 'Database Query', {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      resultCount: results?.length || 0
    });
  },

  // 記錄 API 呼叫效能
  apiCall: (url, method, duration, statusCode) => {
    const level = duration > 5000 ? 'warn' : 'info';
    logger.log(level, 'External API Call', {
      url,
      method,
      duration: `${duration}ms`,
      statusCode
    });
  },

  // 記錄記憶體使用情況
  memory: () => {
    const usage = process.memoryUsage();
    logger.info('Memory Usage', {
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(usage.external / 1024 / 1024)}MB`
    });
  }
};

// 應用程式事件日誌
const appLogger = {
  // 用戶活動
  userActivity: (userId, action, details = {}) => {
    logger.info('User Activity', {
      userId,
      action,
      ...details,
      timestamp: new Date().toISOString()
    });
  },

  // 安全事件
  security: (event, details = {}) => {
    logger.warn('Security Event', {
      event,
      ...details,
      timestamp: new Date().toISOString()
    });
  },

  // 系統事件
  system: (event, details = {}) => {
    logger.info('System Event', {
      event,
      ...details,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  logger,
  httpLogger,
  errorLogger,
  performanceLogger,
  appLogger
};