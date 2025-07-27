const { query } = require('../config/database');

class Playback {
  // 記錄播放資料
  static async create(playbackData) {
    const { 
      user_id, 
      track_id, 
      hex_id, 
      latitude, 
      longitude, 
      played_at, 
      progress_ms, 
      is_playing 
    } = playbackData;

    const result = await query(
      `INSERT INTO user_playback (
        user_id, track_id, hex_id, latitude, longitude, 
        played_at, progress_ms, is_playing
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *`,
      [
        user_id, 
        track_id, 
        hex_id, 
        latitude, 
        longitude, 
        played_at || new Date(), 
        progress_ms, 
        is_playing
      ]
    );
    return result.rows[0];
  }

  // 獲取用戶播放歷史
  static async getUserHistory(userId, limit = 20, offset = 0) {
    const result = await query(
      `SELECT up.*, t.name, t.artist, t.album, t.image_url, t.external_url
       FROM user_playback up
       JOIN tracks t ON up.track_id = t.id
       WHERE up.user_id = $1
       ORDER BY up.played_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  }

  // 獲取用戶播放歷史總數
  static async getUserHistoryCount(userId) {
    const result = await query(
      'SELECT COUNT(*) FROM user_playback WHERE user_id = $1',
      [userId]
    );
    return parseInt(result.rows[0].count);
  }

  // 獲取 Hex 區域的播放記錄
  static async getHexPlaybacks(hexId, limit = 100) {
    const result = await query(
      `SELECT up.*, t.name, t.artist, t.album, t.image_url, 
              u.display_name, u.profile_image_url
       FROM user_playback up
       JOIN tracks t ON up.track_id = t.id
       JOIN users u ON up.user_id = u.id
       WHERE up.hex_id = $1
       ORDER BY up.played_at DESC
       LIMIT $2`,
      [hexId, limit]
    );
    return result.rows;
  }

  // 獲取最近播放記錄 (用於即時更新)
  static async getRecentPlaybacks(minutesAgo = 30) {
    const result = await query(
      `SELECT up.*, t.name, t.artist, t.album, t.image_url,
              u.display_name, u.spotify_id
       FROM user_playback up
       JOIN tracks t ON up.track_id = t.id
       JOIN users u ON up.user_id = u.id
       WHERE up.played_at >= NOW() - INTERVAL '${minutesAgo} minutes'
       ORDER BY up.played_at DESC`,
      []
    );
    return result.rows;
  }

  // 檢查重複播放 (防止重複記錄同一首歌)
  static async checkDuplicate(userId, trackId, hexId, timeWindow = 30) {
    const result = await query(
      `SELECT id FROM user_playback 
       WHERE user_id = $1 AND track_id = $2 AND hex_id = $3
       AND played_at >= NOW() - INTERVAL '${timeWindow} seconds'
       LIMIT 1`,
      [userId, trackId, hexId]
    );
    return result.rows.length > 0;
  }

  // 獲取用戶統計資料
  static async getUserStats(userId) {
    const result = await query(
      `SELECT 
         COUNT(*) as total_plays,
         COUNT(DISTINCT track_id) as unique_tracks,
         COUNT(DISTINCT hex_id) as unique_locations,
         MAX(played_at) as last_played_at,
         MODE() WITHIN GROUP (ORDER BY hex_id) as favorite_hex
       FROM user_playback 
       WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0];
  }

  // 批量插入播放記錄 (用於批次處理)
  static async batchCreate(playbackList) {
    if (playbackList.length === 0) return [];

    const values = playbackList.map((_, index) => {
      const base = index * 8;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
    }).join(', ');

    const params = playbackList.flatMap(item => [
      item.user_id,
      item.track_id,
      item.hex_id,
      item.latitude,
      item.longitude,
      item.played_at || new Date(),
      item.progress_ms,
      item.is_playing
    ]);

    const result = await query(
      `INSERT INTO user_playback (
        user_id, track_id, hex_id, latitude, longitude, 
        played_at, progress_ms, is_playing
      ) VALUES ${values} RETURNING *`,
      params
    );
    return result.rows;
  }
}

module.exports = Playback;