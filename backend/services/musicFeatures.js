const axios = require('axios');
const { logger } = require('../config/logger');
const { query } = require('../config/database');

class MusicFeaturesService {
  /**
   * 從 Spotify 獲取音樂特徵
   * @param {string} trackId - Spotify track ID
   * @param {string} accessToken - Spotify access token
   * @returns {Object} 音樂特徵物件
   */
  static async getAudioFeatures(trackId, accessToken) {
    try {
      const response = await axios.get(
        `https://api.spotify.com/v1/audio-features/${trackId}`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );

      const features = response.data;
      
      // 標準化音樂特徵 (0-1 範圍)
      return {
        energy: features.energy || 0,
        valence: features.valence || 0,
        danceability: features.danceability || 0,
        acousticness: features.acousticness || 0,
        instrumentalness: features.instrumentalness || 0,
        speechiness: features.speechiness || 0,
        liveness: features.liveness || 0,
        loudness: this.normalizeLoudness(features.loudness || -30),
        tempo: this.normalizeTempo(features.tempo || 120),
        popularity: features.popularity || 0
      };
    } catch (error) {
      logger.error('獲取音樂特徵失敗:', { trackId, error: error.message });
      
      // 回傳預設特徵值
      return {
        energy: 0.5,
        valence: 0.5,
        danceability: 0.5,
        acousticness: 0.5,
        instrumentalness: 0.1,
        speechiness: 0.1,
        liveness: 0.1,
        loudness: 0.5,
        tempo: 0.5,
        popularity: 0
      };
    }
  }

  /**
   * 標準化響度值 (-60 到 0 dB 轉換為 0-1)
   */
  static normalizeLoudness(loudness) {
    const min = -60;
    const max = 0;
    return Math.max(0, Math.min(1, (loudness - min) / (max - min)));
  }

  /**
   * 標準化節拍值 (60-200 BPM 轉換為 0-1)
   */
  static normalizeTempo(tempo) {
    const min = 60;
    const max = 200;
    return Math.max(0, Math.min(1, (tempo - min) / (max - min)));
  }

  /**
   * 將音樂特徵轉換為 HSV 色彩
   * @param {Object} features - 音樂特徵物件
   * @returns {Object} HSV 色彩物件
   */
  static featuresToHSV(features) {
    // 處理無效或缺失的特徵值，設定預設值
    const energy = Number.isFinite(features.energy) ? Math.max(0, Math.min(1, features.energy)) : 0.5;
    const valence = Number.isFinite(features.valence) ? Math.max(0, Math.min(1, features.valence)) : 0.5;
    const danceability = Number.isFinite(features.danceability) ? Math.max(0, Math.min(1, features.danceability)) : 0.5;
    const acousticness = Number.isFinite(features.acousticness) ? Math.max(0, Math.min(1, features.acousticness)) : 0.5;
    const tempo = Number.isFinite(features.tempo) ? Math.max(0, Math.min(1, features.tempo)) : 0.5;
    const popularity = Number.isFinite(features.popularity) ? Math.max(0, Math.min(1, features.popularity)) : 0.5;

    // 色相 (Hue): 基於能量和節拍的組合 (0-360度)
    // 高能量 = 紅色系 (0-60), 中能量 = 綠色系 (120-180), 低能量 = 藍色系 (240-300)
    let hue;
    if (energy > 0.7) {
      // 高能量: 紅色到橘色 (0-30度)
      hue = tempo * 30;
    } else if (energy > 0.3) {
      // 中能量: 黃色到綠色 (60-180度)
      hue = 60 + (danceability * 120);
    } else {
      // 低能量: 藍色到紫色 (240-300度)
      hue = 240 + (acousticness * 60);
    }

    // 飽和度 (Saturation): 基於快樂度 (30-90%)
    // 高快樂度 = 高飽和度，低快樂度 = 低飽和度
    const saturation = 30 + (valence * 60);

    // 亮度 (Value): 基於活躍度和流行度 (40-80%)
    // 高活躍度 = 高亮度
    const value = 40 + ((danceability * 0.7 + popularity * 0.3) * 40);

    return {
      h: Math.round(hue) % 360,
      s: Math.round(Math.max(0, Math.min(100, saturation))),
      v: Math.round(Math.max(0, Math.min(100, value)))
    };
  }

  /**
   * HSV 轉換為 HEX 色彩代碼
   * @param {number} h - 色相 (0-360)
   * @param {number} s - 飽和度 (0-100)
   * @param {number} v - 亮度 (0-100)
   * @returns {string} HEX 色彩代碼
   */
  static hsvToHex(h, s, v) {
    s = s / 100;
    v = v / 100;

    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;

    let r, g, b;

    if (h < 60) {
      [r, g, b] = [c, x, 0];
    } else if (h < 120) {
      [r, g, b] = [x, c, 0];
    } else if (h < 180) {
      [r, g, b] = [0, c, x];
    } else if (h < 240) {
      [r, g, b] = [0, x, c];
    } else if (h < 300) {
      [r, g, b] = [x, 0, c];
    } else {
      [r, g, b] = [c, 0, x];
    }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * 音樂特徵轉換為 HEX 色彩 (完整流程)
   * @param {Object} features - 音樂特徵物件
   * @returns {string} HEX 色彩代碼
   */
  static featuresToColor(features) {
    const hsv = this.featuresToHSV(features);
    return this.hsvToHex(hsv.h, hsv.s, hsv.v);
  }

  /**
   * 更新歌曲的音樂特徵資料
   * @param {number} trackId - 資料庫中的 track ID
   * @param {string} spotifyTrackId - Spotify track ID
   * @param {string} accessToken - Spotify access token
   */
  static async updateTrackFeatures(trackId, spotifyTrackId, accessToken) {
    try {
      // 獲取音樂特徵
      const features = await this.getAudioFeatures(spotifyTrackId, accessToken);
      
      // 計算色彩
      const colorHex = this.featuresToColor(features);

      // 更新資料庫
      await query(
        `UPDATE tracks SET 
         audio_features = $1,
         color_hex = $2,
         updated_at = NOW()
         WHERE id = $3`,
        [JSON.stringify(features), colorHex, trackId]
      );

      logger.debug('歌曲特徵已更新:', { 
        trackId, 
        spotifyTrackId, 
        colorHex,
        features: {
          energy: features.energy,
          valence: features.valence,
          danceability: features.danceability
        }
      });

      return { features, colorHex };
    } catch (error) {
      logger.error('更新歌曲特徵失敗:', { trackId, spotifyTrackId, error: error.message });
      throw error;
    }
  }

  /**
   * 批量獲取音樂特徵 (最多 100 首)
   * @param {Array} trackIds - Spotify track ID 陣列
   * @param {string} accessToken - Spotify access token
   */
  static async getBatchAudioFeatures(trackIds, accessToken) {
    try {
      const chunks = [];
      for (let i = 0; i < trackIds.length; i += 100) {
        chunks.push(trackIds.slice(i, i + 100));
      }

      const allFeatures = [];
      
      for (const chunk of chunks) {
        const response = await axios.get(
          `https://api.spotify.com/v1/audio-features?ids=${chunk.join(',')}`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }
        );

        const features = response.data.audio_features.map((feature, index) => ({
          spotify_track_id: chunk[index],
          features: feature ? {
            energy: feature.energy || 0,
            valence: feature.valence || 0,
            danceability: feature.danceability || 0,
            acousticness: feature.acousticness || 0,
            instrumentalness: feature.instrumentalness || 0,
            speechiness: feature.speechiness || 0,
            liveness: feature.liveness || 0,
            loudness: this.normalizeLoudness(feature.loudness || -30),
            tempo: this.normalizeTempo(feature.tempo || 120)
          } : null
        }));

        allFeatures.push(...features);
      }

      return allFeatures;
    } catch (error) {
      logger.error('批量獲取音樂特徵失敗:', error.message);
      throw error;
    }
  }

  /**
   * 生成音樂情緒標籤
   * @param {Object} features - 音樂特徵物件
   * @returns {Array} 情緒標籤陣列
   */
  static generateMoodTags(features) {
    const tags = [];

    // 能量標籤
    if (features.energy > 0.8) tags.push('High Energy');
    else if (features.energy > 0.6) tags.push('Energetic');
    else if (features.energy < 0.3) tags.push('Chill');
    else if (features.energy < 0.4) tags.push('Mellow');

    // 快樂度標籤  
    if (features.valence > 0.75) tags.push('Happy');
    else if (features.valence > 0.55) tags.push('Upbeat');
    else if (features.valence < 0.35) tags.push('Sad');
    else if (features.valence < 0.45) tags.push('Melancholic');

    // 舞蹈性標籤
    if (features.danceability > 0.8) tags.push('Danceable');
    else if (features.danceability > 0.6) tags.push('Groovy');

    // 聲學性標籤
    if (features.acousticness > 0.7) tags.push('Acoustic');
    else if (features.acousticness < 0.2) tags.push('Electronic');

    // 組合情緒
    if (features.energy > 0.7 && features.valence > 0.7) tags.push('Euphoric');
    if (features.energy < 0.4 && features.valence < 0.4) tags.push('Contemplative');
    if (features.danceability > 0.7 && features.energy > 0.6) tags.push('Party');

    return [...new Set(tags)]; // 去重
  }
}

module.exports = MusicFeaturesService;