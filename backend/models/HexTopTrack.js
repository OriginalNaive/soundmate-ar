const { query } = require('../config/database');

class HexTopTrack {
  // 創建或更新 Hex 熱門歌曲記錄
  static async createOrUpdate(hexId, trackId, playedAt = new Date()) {
    // 先檢查是否已存在
    let result = await query(
      'SELECT * FROM hex_top_tracks WHERE hex_id = $1 AND track_id = $2',
      [hexId, trackId]
    );

    if (result.rows.length > 0) {
      // 更新現有記錄
      result = await query(
        `UPDATE hex_top_tracks SET
           play_count = play_count + 1,
           last_played_at = $3,
           updated_at = CURRENT_TIMESTAMP
         WHERE hex_id = $1 AND track_id = $2
         RETURNING *`,
        [hexId, trackId, playedAt]
      );
    } else {
      // 創建新記錄
      result = await query(
        `INSERT INTO hex_top_tracks (hex_id, track_id, play_count, unique_users, last_played_at)
         VALUES ($1, $2, 1, 1, $3)
         RETURNING *`,
        [hexId, trackId, playedAt]
      );
    }

    return result.rows[0];
  }

  // 更新用戶計數 (當不同用戶播放同一首歌時)
  static async updateUniqueUsers(hexId, trackId) {
    const result = await query(
      `UPDATE hex_top_tracks SET
         unique_users = (
           SELECT COUNT(DISTINCT user_id) 
           FROM user_playback 
           WHERE hex_id = $1 AND track_id = $2
         ),
         updated_at = CURRENT_TIMESTAMP
       WHERE hex_id = $1 AND track_id = $2
       RETURNING *`,
      [hexId, trackId]
    );
    return result.rows[0];
  }

  // 重新計算所有排名分數
  static async recalculateRankScores(hexId) {
    await query(
      `UPDATE hex_top_tracks SET
         rank_score = (play_count * 0.7) + (unique_users * 0.3),
         updated_at = CURRENT_TIMESTAMP
       WHERE hex_id = $1`,
      [hexId]
    );
  }

  // 獲取 Hex 的熱門歌曲
  static async getTopTracks(hexId, limit = 10) {
    const result = await query(
      `SELECT htt.*, t.name, t.artist, t.album, t.image_url, 
              t.external_url, t.spotify_track_id, t.duration_ms, t.preview_url
       FROM hex_top_tracks htt
       JOIN tracks t ON htt.track_id = t.id
       WHERE htt.hex_id = $1
       ORDER BY htt.rank_score DESC, htt.play_count DESC
       LIMIT $2`,
      [hexId, limit]
    );
    return result.rows;
  }

  // 獲取 Hex 的分頁歌曲列表
  static async getTracksPaginated(hexId, limit = 20, offset = 0) {
    const result = await query(
      `SELECT htt.*, t.name, t.artist, t.album, t.duration_ms,
              t.preview_url, t.image_url, t.external_url, t.spotify_track_id
       FROM hex_top_tracks htt
       JOIN tracks t ON htt.track_id = t.id
       WHERE htt.hex_id = $1
       ORDER BY htt.rank_score DESC, htt.play_count DESC
       LIMIT $2 OFFSET $3`,
      [hexId, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM hex_top_tracks WHERE hex_id = $1',
      [hexId]
    );

    return {
      tracks: result.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  // 批量處理播放記錄更新
  static async batchProcessPlaybacks(playbackRecords) {
    const promises = playbackRecords.map(async (record) => {
      // 更新 hex_top_tracks
      await this.createOrUpdate(record.hex_id, record.track_id, record.played_at);
      
      // 更新用戶計數
      await this.updateUniqueUsers(record.hex_id, record.track_id);
    });

    await Promise.all(promises);

    // 重新計算所有相關 hex 的排名分數
    const hexIds = [...new Set(playbackRecords.map(r => r.hex_id))];
    for (const hexId of hexIds) {
      await this.recalculateRankScores(hexId);
    }
  }

  // 獲取全域熱門歌曲 (跨所有 Hex)
  static async getGlobalTopTracks(limit = 50) {
    const result = await query(
      `SELECT t.*, 
              SUM(htt.play_count) as total_plays,
              SUM(htt.unique_users) as total_unique_users,
              COUNT(DISTINCT htt.hex_id) as unique_locations,
              MAX(htt.last_played_at) as last_played_at,
              AVG(htt.rank_score) as avg_rank_score
       FROM hex_top_tracks htt
       JOIN tracks t ON htt.track_id = t.id
       GROUP BY t.id, t.spotify_track_id, t.name, t.artist, t.album,
                t.duration_ms, t.preview_url, t.image_url, t.external_url, t.created_at
       ORDER BY total_plays DESC, total_unique_users DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  // 清理低活躍度的記錄 (維護用)
  static async cleanupLowActivity(minPlayCount = 3, daysAgo = 30) {
    const result = await query(
      `DELETE FROM hex_top_tracks 
       WHERE play_count < $1 
         AND last_played_at < NOW() - INTERVAL '${daysAgo} days'
       RETURNING hex_id, track_id`,
      [minPlayCount]
    );
    return result.rows;
  }

  // 獲取歌曲在不同 Hex 的表現
  static async getTrackHexPerformance(trackId) {
    const result = await query(
      `SELECT htt.*, hp.center_lat, hp.center_lng, hp.total_plays as hex_total_plays
       FROM hex_top_tracks htt
       JOIN hex_properties hp ON htt.hex_id = hp.hex_id
       WHERE htt.track_id = $1
       ORDER BY htt.rank_score DESC`,
      [trackId]
    );
    return result.rows;
  }
}

module.exports = HexTopTrack;