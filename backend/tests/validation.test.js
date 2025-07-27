const request = require('supertest');
const express = require('express');
const { validate, schemas } = require('../middleware/validation');

// 建立測試用的 Express 應用程式
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // 測試路由 - 位置更新
  app.post('/test/location', validate(schemas.locationUpdate), (req, res) => {
    res.json({ success: true, data: req.body });
  });

  // 測試路由 - 播放記錄
  app.post('/test/playback', validate(schemas.playbackRecord), (req, res) => {
    res.json({ success: true, data: req.body });
  });

  // 測試路由 - 查詢參數
  app.get('/test/pagination', validate(schemas.pagination, 'query'), (req, res) => {
    res.json({ success: true, data: req.query });
  });

  return app;
};

describe('🔍 API 輸入驗證測試', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('位置更新驗證', () => {
    it('有效的位置資料應該通過驗證', async () => {
      const validLocation = {
        lat: 25.0330,
        lng: 121.5654
      };

      const response = await request(app)
        .post('/test/location')
        .send(validLocation);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(validLocation);
    });

    it('無效的緯度應該回傳錯誤', async () => {
      const invalidLocation = {
        lat: 95, // 超出範圍
        lng: 121.5654
      };

      const response = await request(app)
        .post('/test/location')
        .send(invalidLocation);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details[0].field).toBe('lat');
    });

    it('缺少必填欄位應該回傳錯誤', async () => {
      const incompleteLocation = {
        lat: 25.0330
        // 缺少 lng
      };

      const response = await request(app)
        .post('/test/location')
        .send(incompleteLocation);

      expect(response.status).toBe(400);
      expect(response.body.error.details).toHaveLength(1);
      expect(response.body.error.details[0].field).toBe('lng');
    });
  });

  describe('播放記錄驗證', () => {
    it('有效的播放記錄應該通過驗證', async () => {
      const validPlayback = {
        track_data: {
          id: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh',
          name: 'Test Song',
          artist: 'Test Artist',
          album: 'Test Album',
          image_url: 'https://example.com/image.jpg',
          progress_ms: 30000,
          is_playing: true
        },
        location: {
          lat: 25.0330,
          lng: 121.5654
        },
        hex_id: '8a2a100012d7fff'
      };

      const response = await request(app)
        .post('/test/playback')
        .send(validPlayback);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('無效的 hex_id 格式應該回傳錯誤', async () => {
      const invalidPlayback = {
        track_data: {
          id: 'test-id',
          name: 'Test Song',
          artist: 'Test Artist'
        },
        location: {
          lat: 25.0330,
          lng: 121.5654
        },
        hex_id: 'invalid-hex-id!' // 包含無效字元
      };

      const response = await request(app)
        .post('/test/playback')
        .send(invalidPlayback);

      expect(response.status).toBe(400);
      expect(response.body.error.details.some(
        detail => detail.field === 'hex_id'
      )).toBe(true);
    });

    it('歌曲名稱過長應該回傳錯誤', async () => {
      const longName = 'a'.repeat(501); // 超過 500 字元
      const invalidPlayback = {
        track_data: {
          id: 'test-id',
          name: longName,
          artist: 'Test Artist'
        },
        location: {
          lat: 25.0330,
          lng: 121.5654
        },
        hex_id: '8a2a100012d7fff'
      };

      const response = await request(app)
        .post('/test/playback')
        .send(invalidPlayback);

      expect(response.status).toBe(400);
      expect(response.body.error.details.some(
        detail => detail.field === 'track_data.name'
      )).toBe(true);
    });
  });

  describe('查詢參數驗證', () => {
    it('有效的分頁參數應該通過驗證', async () => {
      const response = await request(app)
        .get('/test/pagination?limit=10&offset=20');

      expect(response.status).toBe(200);
      expect(response.body.data.limit).toBe(10);
      expect(response.body.data.offset).toBe(20);
    });

    it('無效的 limit 應該回傳錯誤', async () => {
      const response = await request(app)
        .get('/test/pagination?limit=101'); // 超過最大值

      expect(response.status).toBe(400);
      expect(response.body.error.details.some(
        detail => detail.field === 'limit'
      )).toBe(true);
    });

    it('預設值應該正確套用', async () => {
      const response = await request(app)
        .get('/test/pagination'); // 不提供參數

      expect(response.status).toBe(200);
      expect(response.body.data.limit).toBe(20); // 預設值
      expect(response.body.data.offset).toBe(0); // 預設值
    });
  });
});