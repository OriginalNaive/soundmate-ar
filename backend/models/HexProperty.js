const { query } = require('../config/database');

class HexProperty {
  // 創建或獲取 Hex 屬性
  static async createOrGet(hexId, centerLat, centerLng, resolution = 9) {
    // 先嘗試獲取現有的
    let result = await query(
      'SELECT * FROM hex_properties WHERE hex_id = $1',
      [hexId]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // 如果不存在，創建新的
    result = await query(
      `INSERT INTO hex_properties (hex_id, center_lat, center_lng, resolution)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [hexId, centerLat, centerLng, resolution]
    );
    return result.rows[0];
  }

  // 更新 Hex 統計資料
  static async updateStats(hexId) {
    const result = await query(
      `UPDATE hex_properties SET
         total_plays = (
           SELECT COUNT(*) FROM user_playback WHERE hex_id = $1
         ),
         unique_users = (
           SELECT COUNT(DISTINCT user_id) FROM user_playback WHERE hex_id = $1
         ),
         unique_tracks = (
           SELECT COUNT(DISTINCT track_id) FROM user_playback WHERE hex_id = $1
         ),
         last_activity_at = (
           SELECT MAX(played_at) FROM user_playback WHERE hex_id = $1
         ),
         updated_at = CURRENT_TIMESTAMP
       WHERE hex_id = $1
       RETURNING *`,
      [hexId]
    );
    return result.rows[0];
  }

  // 批量更新多個 Hex 的統計資料
  static async batchUpdateStats(hexIds) {
    const promises = hexIds.map(hexId => this.updateStats(hexId));
    return await Promise.all(promises);
  }

  // 獲取活躍的 Hex (有播放記錄的)
  static async getActiveHexes(limit = 100) {
    const result = await query(
      `SELECT hp.*, COUNT(htt.id) as tracked_songs_count
       FROM hex_properties hp
       LEFT JOIN hex_top_tracks htt ON hp.hex_id = htt.hex_id
       WHERE hp.total_plays > 0
       GROUP BY hp.hex_id, hp.center_lat, hp.center_lng, hp.resolution,
                hp.total_plays, hp.unique_users, hp.unique_tracks,
                hp.last_activity_at, hp.created_at, hp.updated_at
       ORDER BY hp.total_plays DESC, hp.last_activity_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  // 獲取指定範圍內的 Hex
  static async getHexesInBounds(north, south, east, west) {
    const result = await query(
      `SELECT hp.*, COUNT(htt.id) as tracked_songs_count,
              CASE 
                WHEN hp.total_plays > 50 THEN 'high'
                WHEN hp.total_plays > 10 THEN 'medium'
                ELSE 'low'
              END as activity_level
       FROM hex_properties hp
       LEFT JOIN hex_top_tracks htt ON hp.hex_id = htt.hex_id
       WHERE hp.center_lat BETWEEN $1 AND $2
         AND hp.center_lng BETWEEN $3 AND $4
         AND hp.total_plays > 0
       GROUP BY hp.hex_id, hp.center_lat, hp.center_lng, hp.resolution,
                hp.total_plays, hp.unique_users, hp.unique_tracks,
                hp.last_activity_at, hp.created_at, hp.updated_at
       ORDER BY hp.total_plays DESC`,
      [south, north, west, east]
    );
    return result.rows;
  }

  // 獲取 Hex 列表 (用於特定的 hex_id 數組)
  static async getHexesByIds(hexIds) {
    if (hexIds.length === 0) return [];

    const result = await query(
      `SELECT hp.*, COUNT(htt.id) as tracked_songs_count,
              CASE 
                WHEN hp.total_plays > 50 THEN 'high'
                WHEN hp.total_plays > 10 THEN 'medium'
                ELSE 'low'
              END as activity_level
       FROM hex_properties hp
       LEFT JOIN hex_top_tracks htt ON hp.hex_id = htt.hex_id
       WHERE hp.hex_id = ANY($1::varchar[])
       GROUP BY hp.hex_id, hp.center_lat, hp.center_lng, hp.resolution,
                hp.total_plays, hp.unique_users, hp.unique_tracks,
                hp.last_activity_at, hp.created_at, hp.updated_at
       ORDER BY hp.total_plays DESC`,
      [hexIds]
    );
    return result.rows;
  }

  // 獲取 Hex 詳細資訊
  static async getHexDetails(hexId) {
    const result = await query(
      `SELECT hp.*, COUNT(htt.id) as tracked_songs_count
       FROM hex_properties hp
       LEFT JOIN hex_top_tracks htt ON hp.hex_id = htt.hex_id
       WHERE hp.hex_id = $1
       GROUP BY hp.hex_id, hp.center_lat, hp.center_lng, hp.resolution,
                hp.total_plays, hp.unique_users, hp.unique_tracks,
                hp.last_activity_at, hp.created_at, hp.updated_at`,
      [hexId]
    );
    return result.rows[0] || null;
  }

  // 更新 Hex 的聚合音樂特徵
  static async updateAggregateFeatures(hexId) {
    try {
      // 計算該 hex 所有歌曲的平均音樂特徵
      const result = await query(`
        SELECT 
          AVG((t.audio_features->>'energy')::float) as avg_energy,
          AVG((t.audio_features->>'valence')::float) as avg_valence,
          AVG((t.audio_features->>'danceability')::float) as avg_danceability,
          AVG((t.audio_features->>'acousticness')::float) as avg_acousticness,
          AVG((t.audio_features->>'instrumentalness')::float) as avg_instrumentalness,
          COUNT(*) as feature_count
        FROM user_playback up
        JOIN tracks t ON up.track_id = t.id
        WHERE up.hex_id = $1 
          AND t.audio_features IS NOT NULL
          AND up.played_at >= NOW() - INTERVAL '30 days'
      `, [hexId]);

      if (result.rows.length === 0 || result.rows[0].feature_count === 0) {
        console.log(`No audio features found for hex ${hexId}`);
        return null;
      }

      const features = result.rows[0];
      
      // 如果特徵不完整，跳過
      if (!features.avg_energy || !features.avg_valence || !features.avg_danceability) {
        console.log(`Incomplete features for hex ${hexId}`);
        return null;
      }

      // 使用音樂特徵服務計算色彩
      const MusicFeaturesService = require('../services/musicFeatures');
      const aggregateFeatures = {
        energy: parseFloat(features.avg_energy),
        valence: parseFloat(features.avg_valence),
        danceability: parseFloat(features.avg_danceability),
        acousticness: parseFloat(features.avg_acousticness) || 0.5,
        instrumentalness: parseFloat(features.avg_instrumentalness) || 0.1
      };

      const colorHex = MusicFeaturesService.featuresToColor(aggregateFeatures);

      // 更新資料庫
      const updateResult = await query(`
        UPDATE hex_properties SET
          avg_energy = $1,
          avg_valence = $2,
          avg_danceability = $3,
          avg_acousticness = $4,
          avg_instrumentalness = $5,
          color_hex = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE hex_id = $7
        RETURNING *
      `, [
        aggregateFeatures.energy,
        aggregateFeatures.valence,
        aggregateFeatures.danceability,
        aggregateFeatures.acousticness,
        aggregateFeatures.instrumentalness,
        colorHex,
        hexId
      ]);

      console.log(`Hex ${hexId} 聚合特徵已更新:`, {
        color: colorHex,
        energy: aggregateFeatures.energy.toFixed(2),
        valence: aggregateFeatures.valence.toFixed(2),
        danceability: aggregateFeatures.danceability.toFixed(2),
        trackCount: features.feature_count
      });

      return updateResult.rows[0];
    } catch (error) {
      console.error(`更新 hex ${hexId} 聚合特徵失敗:`, error.message);
      throw error;
    }
  }

  // 批量更新多個 Hex 的聚合特徵
  static async batchUpdateAggregateFeatures(hexIds) {
    const results = [];
    
    for (const hexId of hexIds) {
      try {
        const result = await this.updateAggregateFeatures(hexId);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.error(`批量更新 hex ${hexId} 失敗:`, error.message);
      }
    }
    
    return results;
  }

  // 獲取需要更新特徵的 Hex 列表
  static async getHexesNeedingFeatureUpdate(limit = 50) {
    const result = await query(`
      SELECT DISTINCT hp.hex_id
      FROM hex_properties hp
      WHERE hp.total_plays > 0
        AND (hp.color_hex IS NULL OR hp.updated_at < NOW() - INTERVAL '1 hour')
        AND EXISTS (
          SELECT 1 FROM user_playback up
          JOIN tracks t ON up.track_id = t.id
          WHERE up.hex_id = hp.hex_id 
            AND t.audio_features IS NOT NULL
        )
      ORDER BY hp.total_plays DESC
      LIMIT $1
    `, [limit]);

    return result.rows.map(row => row.hex_id);
  }

  // 生成 Hex 音樂標籤
  static async generateHexMoodTags(hexId) {
    try {
      const result = await query(`
        SELECT avg_energy, avg_valence, avg_danceability, avg_acousticness
        FROM hex_properties
        WHERE hex_id = $1
      `, [hexId]);

      if (result.rows.length === 0) {
        return [];
      }

      const features = result.rows[0];
      const MusicFeaturesService = require('../services/musicFeatures');
      
      return MusicFeaturesService.generateMoodTags({
        energy: features.avg_energy || 0.5,
        valence: features.avg_valence || 0.5,
        danceability: features.avg_danceability || 0.5,
        acousticness: features.avg_acousticness || 0.5
      });
    } catch (error) {
      console.error(`生成 hex ${hexId} 標籤失敗:`, error.message);
      return [];
    }
  }

  // 清理無活動的 Hex (維護用)
  static async cleanupInactiveHexes(daysAgo = 30) {
    const result = await query(
      `DELETE FROM hex_properties 
       WHERE total_plays = 0 
         AND created_at < NOW() - INTERVAL '${daysAgo} days'
       RETURNING hex_id`,
      []
    );
    return result.rows.map(row => row.hex_id);
  }
}

module.exports = HexProperty;