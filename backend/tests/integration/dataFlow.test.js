const request = require('supertest');
const app = require('../../server');
const { query } = require('../../config/database');

describe('🔄 完整資料流程整合測試', () => {
  let testUserId;
  let testTrackId;
  let testHexId = '891f1d4a5afffff'; // 測試用 H3 ID

  beforeAll(async () => {
    // 清理測試資料
    await query('DELETE FROM user_playback WHERE hex_id = $1', [testHexId]);
    await query('DELETE FROM hex_top_tracks WHERE hex_id = $1', [testHexId]);
    await query('DELETE FROM hex_properties WHERE hex_id = $1', [testHexId]);
    
    // 建立測試用戶
    const userResult = await query(`
      INSERT INTO users (spotify_id, display_name, email, access_token, refresh_token)
      VALUES ('test_user_123', '測試用戶', 'test@example.com', 'test_access_token', 'test_refresh_token')
      RETURNING id
    `);
    testUserId = userResult.rows[0].id;

    // 建立測試歌曲
    const trackResult = await query(`
      INSERT INTO tracks (spotify_track_id, name, artist, album, duration_ms)
      VALUES ('test_track_123', '測試歌曲', '測試藝人', '測試專輯', 180000)
      RETURNING id
    `);
    testTrackId = trackResult.rows[0].id;
  });

  afterAll(async () => {
    // 清理測試資料
    await query('DELETE FROM user_playback WHERE user_id = $1', [testUserId]);
    await query('DELETE FROM hex_top_tracks WHERE hex_id = $1', [testHexId]);
    await query('DELETE FROM hex_properties WHERE hex_id = $1', [testHexId]);
    await query('DELETE FROM tracks WHERE id = $1', [testTrackId]);
    await query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  describe('📱 播放記錄與特徵處理', () => {
    it('應該成功記錄播放並觸發特徵處理', async () => {
      const playbackData = {
        track_data: {
          spotify_track_id: 'test_track_123',
          name: '測試歌曲',
          artist: '測試藝人',
          album: '測試專輯',
          duration_ms: 180000,
          is_playing: true,
          progress_ms: 30000
        },
        location: {
          lat: 25.0330,
          lng: 121.5654
        },
        hex_id: testHexId
      };

      const response = await request(app)
        .post('/api/music/playback')
        .set('Authorization', 'Bearer test_access_token')
        .send(playbackData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hex_id).toBe(testHexId);
      expect(response.body.data.message).toBe('Playback recorded successfully');

      // 驗證資料庫記錄
      const playbackResult = await query(
        'SELECT * FROM user_playback WHERE user_id = $1 AND hex_id = $2',
        [testUserId, testHexId]
      );
      expect(playbackResult.rows.length).toBe(1);
    });

    it('應該更新 hex_properties 統計', async () => {
      // 等待背景統計更新
      await new Promise(resolve => setTimeout(resolve, 1000));

      const hexResult = await query(
        'SELECT * FROM hex_properties WHERE hex_id = $1',
        [testHexId]
      );

      expect(hexResult.rows.length).toBe(1);
      const hexData = hexResult.rows[0];
      expect(hexData.total_plays).toBeGreaterThan(0);
      expect(hexData.unique_users).toBeGreaterThan(0);
      expect(hexData.unique_tracks).toBeGreaterThan(0);
    });
  });

  describe('🗺️ 地圖 API 測試', () => {
    it('應該正確回傳地圖邊界內的六邊形', async () => {
      const bounds = {
        north: 25.04,
        south: 25.02,
        east: 121.58,
        west: 121.55
      };

      const response = await request(app)
        .get('/api/map/hexagons')
        .query(bounds)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hexagons).toBeInstanceOf(Array);
      expect(response.body.data.bounds).toMatchObject(bounds);
    });

    it('應該正確回傳單個六邊形詳細資訊', async () => {
      const response = await request(app)
        .get(`/api/map/hex/${testHexId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hex_info).toBeDefined();
      expect(response.body.data.hex_info.hex_id).toBe(testHexId);
    });

    it('應該正確回傳六邊形熱門歌曲', async () => {
      const response = await request(app)
        .get(`/api/map/hex/${testHexId}/tracks`)
        .query({ limit: 5 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tracks).toBeInstanceOf(Array);
      expect(response.body.data.hex_id).toBe(testHexId);
    });
  });

  describe('🎵 音樂特徵處理', () => {
    it('應該正確處理音樂特徵到色彩的轉換', async () => {
      const MusicFeaturesService = require('../../services/musicFeatures');

      const testFeatures = {
        energy: 0.8,
        valence: 0.7,
        danceability: 0.9,
        acousticness: 0.1,
        instrumentalness: 0.05
      };

      const hsv = MusicFeaturesService.featuresToHSV(testFeatures);
      expect(hsv.h).toBeGreaterThanOrEqual(0);
      expect(hsv.h).toBeLessThan(360);
      expect(hsv.s).toBeGreaterThanOrEqual(30);
      expect(hsv.s).toBeLessThanOrEqual(90);
      expect(hsv.v).toBeGreaterThanOrEqual(40);
      expect(hsv.v).toBeLessThanOrEqual(80);

      const colorHex = MusicFeaturesService.featuresToColor(testFeatures);
      expect(colorHex).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('應該正確生成音樂情緒標籤', async () => {
      const MusicFeaturesService = require('../../services/musicFeatures');

      const highEnergyFeatures = {
        energy: 0.9,
        valence: 0.8,
        danceability: 0.85,
        acousticness: 0.1
      };

      const tags = MusicFeaturesService.generateMoodTags(highEnergyFeatures);
      expect(tags).toContain('High Energy');
      expect(tags).toContain('Happy');
      expect(tags).toContain('Danceable');
    });
  });

  describe('📊 Hex 聚合服務', () => {
    it('應該正確更新 hex 聚合特徵', async () => {
      const HexProperty = require('../../models/HexProperty');

      // 先添加測試歌曲的音樂特徵
      await query(`
        UPDATE tracks SET 
        audio_features = $1,
        color_hex = $2
        WHERE id = $3
      `, [
        JSON.stringify({
          energy: 0.7,
          valence: 0.6,
          danceability: 0.8,
          acousticness: 0.2,
          instrumentalness: 0.1
        }),
        '#ff6b35',
        testTrackId
      ]);

      // 執行聚合更新
      const result = await HexProperty.updateAggregateFeatures(testHexId);
      expect(result).toBeDefined();
      expect(result.color_hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(result.avg_energy).toBeGreaterThan(0);
      expect(result.avg_valence).toBeGreaterThan(0);
    });
  });

  describe('🚀 效能與錯誤處理', () => {
    it('應該正確處理無效的六邊形 ID', async () => {
      const response = await request(app)
        .get('/api/map/hex/invalid_hex_id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('HEX_NOT_FOUND');
    });

    it('應該正確處理缺少邊界參數的請求', async () => {
      const response = await request(app)
        .get('/api/map/hexagons')
        .query({ north: 25.04, south: 25.02 }) // 缺少 east, west
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_BOUNDS');
    });

    it('應該正確處理重複播放記錄', async () => {
      const playbackData = {
        track_data: {
          spotify_track_id: 'test_track_123',
          name: '測試歌曲',
          artist: '測試藝人',
          album: '測試專輯',
          duration_ms: 180000,
          is_playing: true,
          progress_ms: 30000
        },
        location: {
          lat: 25.0330,
          lng: 121.5654
        },
        hex_id: testHexId
      };

      // 第一次記錄
      await request(app)
        .post('/api/music/playback')
        .set('Authorization', 'Bearer test_access_token')
        .send(playbackData)
        .expect(200);

      // 立即重複記錄 (應該被忽略)
      const response = await request(app)
        .post('/api/music/playback')
        .set('Authorization', 'Bearer test_access_token')
        .send(playbackData)
        .expect(200);

      expect(response.body.data.message).toBe('Duplicate playback ignored');
    });
  });
});