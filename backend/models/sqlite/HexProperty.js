const { query } = require('../../config/database');

class HexProperty {
  // 創建或獲取 Hex 屬性
  static async createOrGet(hexId, centerLat, centerLng) {
    // 先嘗試獲取現有的
    let result = await query(
      'SELECT * FROM hex_properties WHERE hex_id = ?',
      [hexId]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // 如果不存在，創建新的
    const id = `hex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    result = await query(
      `INSERT INTO hex_properties (id, hex_id, center_lat, center_lng, total_plays, unique_users, unique_tracks, color_hex)
       VALUES (?, ?, ?, ?, 0, 0, 0, '#1DB954')`,
      [id, hexId, centerLat, centerLng]
    );
    
    // 回傳創建的記錄
    const newResult = await query(
      'SELECT * FROM hex_properties WHERE hex_id = ?',
      [hexId]
    );
    return newResult.rows[0];
  }

  // 更新 Hex 統計資料
  static async updateStats(hexId) {
    try {
      // 計算統計數據
      const stats = await query(`
        SELECT 
          COUNT(*) as total_plays,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT track_id) as unique_tracks,
          AVG(latitude) as center_lat,
          AVG(longitude) as center_lng
        FROM user_playback 
        WHERE hex_id = ?
      `, [hexId]);

      if (stats.rows.length === 0 || stats.rows[0].total_plays === 0) {
        return null;
      }

      const stat = stats.rows[0];
      
      // 更新 hex_properties
      const result = await query(
        `UPDATE hex_properties SET
           total_plays = ?,
           unique_users = ?,
           unique_tracks = ?,
           center_lat = ?,
           center_lng = ?,
           last_updated = CURRENT_TIMESTAMP
         WHERE hex_id = ?`,
        [
          stat.total_plays,
          stat.unique_users, 
          stat.unique_tracks,
          stat.center_lat,
          stat.center_lng,
          hexId
        ]
      );

      return result.rowCount > 0;
    } catch (error) {
      console.error('更新 Hex 統計失敗:', { hexId, error: error.message });
      return false;
    }
  }

  // 獲取需要更新特徵的 Hex
  static async getHexesNeedingFeatureUpdate() {
    try {
      const result = await query(`
        SELECT DISTINCT hex_id
        FROM user_playback up
        WHERE up.audio_features IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM hex_properties hp 
            WHERE hp.hex_id = up.hex_id 
              AND hp.avg_energy IS NOT NULL
          )
        LIMIT 50
      `);
      
      return result.rows.map(row => row.hex_id);
    } catch (error) {
      console.error('獲取需要更新的 Hex 失敗:', error.message);
      return [];
    }
  }

  // 更新音樂特徵統計
  static async updateMusicFeatures(hexId) {
    try {
      // 計算音樂特徵平均值
      const features = await query(`
        SELECT 
          AVG(json_extract(audio_features, '$.energy')) as avg_energy,
          AVG(json_extract(audio_features, '$.valence')) as avg_valence,
          AVG(json_extract(audio_features, '$.danceability')) as avg_danceability,
          AVG(json_extract(audio_features, '$.tempo')) as avg_tempo
        FROM user_playback 
        WHERE hex_id = ? AND audio_features IS NOT NULL
      `, [hexId]);

      if (features.rows.length === 0) {
        return false;
      }

      const feature = features.rows[0];
      
      // 更新特徵數據
      const result = await query(
        `UPDATE hex_properties SET
           avg_energy = ?,
           avg_valence = ?,
           avg_danceability = ?,
           avg_tempo = ?,
           last_updated = CURRENT_TIMESTAMP
         WHERE hex_id = ?`,
        [
          feature.avg_energy,
          feature.avg_valence,
          feature.avg_danceability,
          feature.avg_tempo,
          hexId
        ]
      );

      return result.rowCount > 0;
    } catch (error) {
      console.error('更新音樂特徵失敗:', { hexId, error: error.message });
      return false;
    }
  }

  // 獲取所有活躍的 Hex
  static async getActiveHexes(limit = 100) {
    try {
      const result = await query(
        `SELECT * FROM hex_properties 
         WHERE total_plays > 0 
         ORDER BY total_plays DESC 
         LIMIT ?`,
        [limit]
      );
      return result.rows;
    } catch (error) {
      console.error('獲取活躍 Hex 失敗:', error.message);
      return [];
    }
  }

  // 根據位置查找附近的 Hex
  static async findNearby(lat, lng, radiusKm = 5) {
    try {
      // 簡化的距離計算（實際應用中可能需要更精確的地理計算）
      const latDiff = radiusKm / 111; // 大約每度緯度 111km
      const lngDiff = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
      
      const result = await query(
        `SELECT *, 
         ((center_lat - ?) * (center_lat - ?) + (center_lng - ?) * (center_lng - ?)) as distance_sq
         FROM hex_properties 
         WHERE center_lat BETWEEN ? AND ?
           AND center_lng BETWEEN ? AND ?
           AND total_plays > 0
         ORDER BY distance_sq
         LIMIT 20`,
        [
          lat, lat, lng, lng,
          lat - latDiff, lat + latDiff,
          lng - lngDiff, lng + lngDiff
        ]
      );
      
      return result.rows;
    } catch (error) {
      console.error('查找附近 Hex 失敗:', error.message);
      return [];
    }
  }

  // 獲取單個 Hex 詳細資訊
  static async findById(hexId) {
    try {
      const result = await query(
        'SELECT * FROM hex_properties WHERE hex_id = ?',
        [hexId]
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('查找 Hex 失敗:', { hexId, error: error.message });
      return null;
    }
  }

  // 批量更新統計
  static async batchUpdateStats(hexIds) {
    const results = [];
    
    for (const hexId of hexIds) {
      try {
        const success = await this.updateStats(hexId);
        results.push({ hexId, success });
      } catch (error) {
        console.error(`批量更新失敗 ${hexId}:`, error.message);
        results.push({ hexId, success: false, error: error.message });
      }
    }
    
    return results;
  }
}

module.exports = HexProperty;