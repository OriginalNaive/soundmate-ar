const request = require('supertest');
const express = require('express');

// 模擬資料庫配置
jest.mock('../config/database', () => ({
  query: jest.fn()
}));

// 模擬日誌配置
jest.mock('../config/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  },
  httpLogger: (req, res, next) => next(),
  errorLogger: (err, req, res, next) => next(),
  appLogger: {
    system: jest.fn()
  }
}));

const { query } = require('../config/database');

// 建立測試用的健康檢查端點
const createHealthApp = () => {
  const app = express();
  app.use(express.json());

  // 健康檢查端點
  app.get('/health', async (req, res) => {
    const healthCheck = {
      uptime: process.uptime(),
      message: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'test',
      version: '1.0.0'
    };

    try {
      // 檢查資料庫連線
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
                     memory.heapUsed < memory.heapTotal * 0.9;

    const statusCode = isHealthy ? 200 : 503;
    healthCheck.status = isHealthy ? 'healthy' : 'unhealthy';

    res.status(statusCode).json({ 
      success: isHealthy, 
      data: healthCheck
    });
  });

  return app;
};

describe('🩺 健康檢查端點測試', () => {
  let app;

  beforeAll(() => {
    app = createHealthApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('資料庫連線正常時應該回傳健康狀態', async () => {
      // 模擬資料庫查詢成功
      query.mockResolvedValue({ rows: [{ '?column?': 1 }] });

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.database.status).toBe('connected');
      expect(response.body.data.uptime).toBeGreaterThan(0);
      expect(response.body.data.memory).toBeDefined();
      expect(response.body.data.cpu).toBeDefined();
    });

    it('資料庫連線失敗時應該回傳不健康狀態', async () => {
      // 模擬資料庫查詢失敗
      query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.data.status).toBe('unhealthy');
      expect(response.body.data.database.status).toBe('disconnected');
      expect(response.body.data.database.error).toBe('Database connection failed');
    });

    it('應該包含系統資訊', async () => {
      query.mockResolvedValue({ rows: [{ '?column?': 1 }] });

      const response = await request(app).get('/health');

      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.environment).toBe('test');
      expect(response.body.data.version).toBe('1.0.0');
      expect(response.body.data.uptime).toBeGreaterThanOrEqual(0);
    });

    it('記憶體資訊應該正確格式', async () => {
      query.mockResolvedValue({ rows: [{ '?column?': 1 }] });

      const response = await request(app).get('/health');

      const memory = response.body.data.memory;
      expect(memory.rss).toMatch(/\d+MB/);
      expect(memory.heapTotal).toMatch(/\d+MB/);
      expect(memory.heapUsed).toMatch(/\d+MB/);
      expect(memory.external).toMatch(/\d+MB/);
    });

    it('CPU 資訊應該存在', async () => {
      query.mockResolvedValue({ rows: [{ '?column?': 1 }] });

      const response = await request(app).get('/health');

      const cpu = response.body.data.cpu;
      expect(typeof cpu.user).toBe('number');
      expect(typeof cpu.system).toBe('number');
      expect(cpu.user).toBeGreaterThanOrEqual(0);
      expect(cpu.system).toBeGreaterThanOrEqual(0);
    });

    it('資料庫回應時間應該被記錄', async () => {
      query.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ rows: [{ '?column?': 1 }] }), 10))
      );

      const response = await request(app).get('/health');

      expect(response.body.data.database.responseTime).toMatch(/\d+ms/);
      const responseTime = parseInt(response.body.data.database.responseTime);
      expect(responseTime).toBeGreaterThanOrEqual(10);
    });
  });
});