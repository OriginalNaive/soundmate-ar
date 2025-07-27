const request = require('supertest');
const express = require('express');
const { 
  createRateLimit, 
  createSizeLimit, 
  userAgentCheck,
  helmetConfig
} = require('../middleware/security');

// 建立測試用的 Express 應用程式
const createTestApp = () => {
  const app = express();
  
  // 基本設定
  app.set('trust proxy', 1);
  app.use(express.json());
  
  return app;
};

describe('🛡️ 安全中介軟體測試', () => {
  
  describe('速率限制測試', () => {
    let app;

    beforeAll(() => {
      app = createTestApp();
      
      // 套用速率限制 (每分鐘 3 次請求用於測試)
      const testRateLimit = createRateLimit(60 * 1000, 3, '測試速率限制');
      app.use('/test-rate', testRateLimit);
      
      app.get('/test-rate', (req, res) => {
        res.json({ success: true, message: '請求成功' });
      });
    });

    it('正常請求應該成功', async () => {
      const response = await request(app).get('/test-rate');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('超過速率限制應該回傳 429', async () => {
      // 快速發送多個請求
      await request(app).get('/test-rate');
      await request(app).get('/test-rate');
      await request(app).get('/test-rate');
      
      // 第四個請求應該被拒絕
      const response = await request(app).get('/test-rate');
      
      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('請求大小限制測試', () => {
    let app;

    beforeAll(() => {
      app = createTestApp();
      app.use(createSizeLimit('1kb')); // 1KB 限制用於測試
      
      app.post('/test-size', (req, res) => {
        res.json({ success: true, data: req.body });
      });
    });

    it('小於限制的請求應該成功', async () => {
      const smallData = { message: 'hello' };
      
      const response = await request(app)
        .post('/test-size')
        .send(smallData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('超過大小限制的請求應該回傳 413', async () => {
      const largeData = { message: 'a'.repeat(2000) }; // 超過 1KB
      
      const response = await request(app)
        .post('/test-size')
        .send(largeData);
      
      expect(response.status).toBe(413);
      expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  describe('User-Agent 檢查測試', () => {
    let app;

    beforeAll(() => {
      app = createTestApp();
      app.use(userAgentCheck);
      
      app.get('/test-ua', (req, res) => {
        res.json({ success: true, message: '通過 User-Agent 檢查' });
      });
    });

    it('有效的 User-Agent 應該通過', async () => {
      const response = await request(app)
        .get('/test-ua')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('缺少 User-Agent 應該回傳 400', async () => {
      const response = await request(app).get('/test-ua');
      
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_USER_AGENT');
    });
  });

  describe('Helmet 安全標頭測試', () => {
    let app;

    beforeAll(() => {
      app = createTestApp();
      app.use(helmetConfig);
      
      app.get('/test-helmet', (req, res) => {
        res.json({ success: true });
      });
    });

    it('應該設定安全標頭', async () => {
      const response = await request(app).get('/test-helmet');
      
      expect(response.status).toBe(200);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });
  });
});