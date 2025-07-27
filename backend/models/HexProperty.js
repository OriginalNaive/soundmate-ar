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