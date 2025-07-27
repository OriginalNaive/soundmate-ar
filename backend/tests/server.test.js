const request = require('supertest');
const express = require('express');

// 創建測試用的 app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // 基本路由
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

  return app;
};

describe('🏠 基本 API 端點測試', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('GET /', () => {
    it('應該回傳成功的回應', async () => {
      const response = await request(app).get('/');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('SoundMate AR backend is live');
      expect(response.body.data.version).toBe('1.0.0');
    });

    it('應該包含時間戳記', async () => {
      const response = await request(app).get('/');
      
      expect(response.body.data.timestamp).toBeDefined();
      expect(new Date(response.body.data.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('GET /health', () => {
    it('應該回傳健康檢查資訊', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.uptime).toBeGreaterThanOrEqual(0);
      expect(response.body.data.memory).toBeDefined();
    });

    it('記憶體使用量應該是物件', async () => {
      const response = await request(app).get('/health');
      
      expect(typeof response.body.data.memory).toBe('object');
      expect(response.body.data.memory.rss).toBeDefined();
      expect(response.body.data.memory.heapTotal).toBeDefined();
      expect(response.body.data.memory.heapUsed).toBeDefined();
    });
  });

  describe('404 錯誤處理', () => {
    it('應該回傳 404 錯誤', async () => {
      const response = await request(app).get('/nonexistent');
      
      expect(response.status).toBe(404);
    });
  });
});