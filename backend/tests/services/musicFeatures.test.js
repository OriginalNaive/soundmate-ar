const MusicFeaturesService = require('../../services/musicFeatures');

describe('🎵 音樂特徵服務測試', () => {
  describe('特徵標準化', () => {
    it('應該正確標準化響度值', () => {
      expect(MusicFeaturesService.normalizeLoudness(-60)).toBe(0);
      expect(MusicFeaturesService.normalizeLoudness(0)).toBe(1);
      expect(MusicFeaturesService.normalizeLoudness(-30)).toBe(0.5);
      expect(MusicFeaturesService.normalizeLoudness(-70)).toBe(0); // 超出範圍
      expect(MusicFeaturesService.normalizeLoudness(10)).toBe(1); // 超出範圍
    });

    it('應該正確標準化節拍值', () => {
      expect(MusicFeaturesService.normalizeTempo(60)).toBe(0);
      expect(MusicFeaturesService.normalizeTempo(200)).toBe(1);
      expect(MusicFeaturesService.normalizeTempo(130)).toBe(0.5);
      expect(MusicFeaturesService.normalizeTempo(50)).toBe(0); // 超出範圍
      expect(MusicFeaturesService.normalizeTempo(250)).toBe(1); // 超出範圍
    });
  });

  describe('色彩轉換', () => {
    it('應該將音樂特徵轉換為有效的 HSV 值', () => {
      const features = {
        energy: 0.8,
        valence: 0.7,
        danceability: 0.9,
        acousticness: 0.1,
        instrumentalness: 0.05,
        tempo: 0.6,
        popularity: 0.8
      };

      const hsv = MusicFeaturesService.featuresToHSV(features);
      
      expect(hsv.h).toBeGreaterThanOrEqual(0);
      expect(hsv.h).toBeLessThan(360);
      expect(hsv.s).toBeGreaterThanOrEqual(30);
      expect(hsv.s).toBeLessThanOrEqual(90);
      expect(hsv.v).toBeGreaterThanOrEqual(40);
      expect(hsv.v).toBeLessThanOrEqual(80);
    });

    it('應該將 HSV 正確轉換為 HEX 色彩代碼', () => {
      const testCases = [
        { h: 0, s: 100, v: 100, expected: '#ff0000' },    // 純紅色
        { h: 120, s: 100, v: 100, expected: '#00ff00' },  // 純綠色
        { h: 240, s: 100, v: 100, expected: '#0000ff' },  // 純藍色
        { h: 0, s: 0, v: 0, expected: '#000000' },        // 黑色
        { h: 0, s: 0, v: 100, expected: '#ffffff' },      // 白色
      ];

      testCases.forEach(({ h, s, v, expected }) => {
        const result = MusicFeaturesService.hsvToHex(h, s, v);
        expect(result.toLowerCase()).toBe(expected);
      });
    });

    it('應該產生有效的 HEX 色彩代碼', () => {
      const features = {
        energy: 0.6,
        valence: 0.5,
        danceability: 0.7,
        acousticness: 0.3,
        instrumentalness: 0.1,
        tempo: 0.4,
        popularity: 0.6
      };

      const colorHex = MusicFeaturesService.featuresToColor(features);
      expect(colorHex).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  describe('情緒標籤生成', () => {
    it('應該為高能量音樂生成正確標籤', () => {
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
      expect(tags).toContain('Euphoric'); // 組合情緒
    });

    it('應該為低能量音樂生成正確標籤', () => {
      const lowEnergyFeatures = {
        energy: 0.2,
        valence: 0.3,
        danceability: 0.3,
        acousticness: 0.8
      };

      const tags = MusicFeaturesService.generateMoodTags(lowEnergyFeatures);
      expect(tags).toContain('Chill');
      expect(tags).toContain('Sad');
      expect(tags).toContain('Acoustic');
      expect(tags).toContain('Contemplative'); // 組合情緒
    });

    it('應該為電子舞曲生成正確標籤', () => {
      const electronicFeatures = {
        energy: 0.85,
        valence: 0.8, // 提高到 0.8 以達到 Happy 標籤閾值
        danceability: 0.9,
        acousticness: 0.05
      };

      const tags = MusicFeaturesService.generateMoodTags(electronicFeatures);
      expect(tags).toContain('High Energy');
      expect(tags).toContain('Happy');
      expect(tags).toContain('Danceable');
      expect(tags).toContain('Electronic');
      expect(tags).toContain('Party'); // 組合情緒
    });

    it('應該避免重複標籤', () => {
      const features = {
        energy: 0.9,
        valence: 0.9,
        danceability: 0.9,
        acousticness: 0.1
      };

      const tags = MusicFeaturesService.generateMoodTags(features);
      const uniqueTags = [...new Set(tags)];
      expect(tags.length).toBe(uniqueTags.length);
    });
  });

  describe('邊界情況處理', () => {
    it('應該處理缺失或無效的特徵值', () => {
      const incompleteFeatures = {
        energy: null,
        valence: undefined,
        danceability: 0.5
      };

      // 應該不會拋出錯誤
      expect(() => {
        MusicFeaturesService.featuresToHSV(incompleteFeatures);
      }).not.toThrow();
    });

    it('應該處理極端特徵值', () => {
      const extremeFeatures = {
        energy: 1.5, // 超出範圍
        valence: -0.2, // 負值
        danceability: 0,
        acousticness: 1,
        instrumentalness: 1
      };

      const hsv = MusicFeaturesService.featuresToHSV(extremeFeatures);
      expect(hsv.h).toBeGreaterThanOrEqual(0);
      expect(hsv.h).toBeLessThan(360);
      expect(hsv.s).toBeGreaterThanOrEqual(0);
      expect(hsv.s).toBeLessThanOrEqual(100);
      expect(hsv.v).toBeGreaterThanOrEqual(0);
      expect(hsv.v).toBeLessThanOrEqual(100);
    });
  });

  describe('色彩一致性', () => {
    it('相同特徵應該產生相同色彩', () => {
      const features = {
        energy: 0.6,
        valence: 0.7,
        danceability: 0.8,
        acousticness: 0.2,
        instrumentalness: 0.1
      };

      const color1 = MusicFeaturesService.featuresToColor(features);
      const color2 = MusicFeaturesService.featuresToColor(features);
      expect(color1).toBe(color2);
    });

    it('不同特徵應該產生不同色彩', () => {
      const features1 = {
        energy: 0.8,
        valence: 0.9,
        danceability: 0.7,
        acousticness: 0.1,
        instrumentalness: 0.05
      };

      const features2 = {
        energy: 0.2,
        valence: 0.3,
        danceability: 0.4,
        acousticness: 0.8,
        instrumentalness: 0.6
      };

      const color1 = MusicFeaturesService.featuresToColor(features1);
      const color2 = MusicFeaturesService.featuresToColor(features2);
      expect(color1).not.toBe(color2);
    });
  });

  describe('效能測試', () => {
    it('應該快速處理大量特徵轉換', () => {
      const features = {
        energy: 0.7,
        valence: 0.6,
        danceability: 0.8,
        acousticness: 0.3,
        instrumentalness: 0.1
      };

      const startTime = Date.now();
      
      // 處理 1000 次轉換
      for (let i = 0; i < 1000; i++) {
        MusicFeaturesService.featuresToColor({
          ...features,
          energy: Math.random(),
          valence: Math.random(),
          danceability: Math.random()
        });
      }

      const duration = Date.now() - startTime;
      console.log(`1000 次色彩轉換耗時: ${duration}ms`);
      
      // 應該在 1 秒內完成
      expect(duration).toBeLessThan(1000);
    });
  });
});