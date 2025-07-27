const { query } = require('../config/database');

class Track {
  // 根據 Spotify ID 查找歌曲
  static async findBySpotifyId(spotifyTrackId) {
    const result = await query(
      'SELECT * FROM tracks WHERE spotify_track_id = $1',
      [spotifyTrackId]
    );
    return result.rows[0] || null;
  }

  // 創建新歌曲
  static async create(trackData) {
    const { 
      spotify_track_id, 
      name, 
      artist, 
      album, 
      duration_ms, 
      preview_url, 
      image_url, 
      external_url 
    } = trackData;

    const result = await query(
      `INSERT INTO tracks (
        spotify_track_id, name, artist, album, 
        duration_ms, preview_url, image_url, external_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *`,
      [
        spotify_track_id, 
        name, 
        artist, 
        album, 
        duration_ms, 
        preview_url, 
        image_url, 
        external_url
      ]
    );
    return result.rows[0];
  }

  // 創建或獲取歌曲 (upsert)
  static async createOrGet(trackData) {
    const existingTrack = await this.findBySpotifyId(trackData.spotify_track_id);
    
    if (existingTrack) {
      return existingTrack;
    } else {
      return await this.create(trackData);
    }
  }

  // 獲取熱門歌曲
  static async getPopular(limit = 50) {
    const result = await query(
      `SELECT t.*, COUNT(up.id) as play_count, 
              COUNT(DISTINCT up.user_id) as unique_users
       FROM tracks t
       LEFT JOIN user_playback up ON t.id = up.track_id
       WHERE up.played_at >= NOW() - INTERVAL '7 days'
       GROUP BY t.id
       ORDER BY play_count DESC, unique_users DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  // 根據 ID 獲取歌曲詳情和統計
  static async getDetailsWithStats(trackId) {
    const result = await query(
      `SELECT t.*, 
              COUNT(up.id) as total_plays,
              COUNT(DISTINCT up.user_id) as unique_users,
              COUNT(DISTINCT up.hex_id) as unique_locations,
              MAX(up.played_at) as last_played_at
       FROM tracks t
       LEFT JOIN user_playback up ON t.id = up.track_id
       WHERE t.id = $1
       GROUP BY t.id`,
      [trackId]
    );
    return result.rows[0] || null;
  }

  // 搜索歌曲
  static async search(searchTerm, limit = 20) {
    const result = await query(
      `SELECT * FROM tracks 
       WHERE name ILIKE $1 OR artist ILIKE $1
       ORDER BY name
       LIMIT $2`,
      [`%${searchTerm}%`, limit]
    );
    return result.rows;
  }
}

module.exports = Track;