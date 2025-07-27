const { query } = require('../config/database');

class User {
  // 根據 Spotify ID 查找用戶
  static async findBySpotifyId(spotifyId) {
    const result = await query(
      'SELECT * FROM users WHERE spotify_id = $1',
      [spotifyId]
    );
    return result.rows[0] || null;
  }

  // 創建新用戶
  static async create(userData) {
    const { 
      spotify_id, 
      display_name, 
      email, 
      profile_image_url, 
      access_token, 
      refresh_token,
      expires_in
    } = userData;

    const token_expires_at = new Date(Date.now() + expires_in * 1000);

    const result = await query(
      `INSERT INTO users (
        spotify_id, display_name, email, profile_image_url, 
        access_token, refresh_token, token_expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *`,
      [
        spotify_id, 
        display_name, 
        email, 
        profile_image_url, 
        access_token, 
        refresh_token, 
        token_expires_at
      ]
    );
    return result.rows[0];
  }

  // 更新用戶資料
  static async update(spotifyId, userData) {
    const { 
      display_name, 
      email, 
      profile_image_url, 
      access_token, 
      refresh_token,
      expires_in
    } = userData;

    const token_expires_at = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

    const result = await query(
      `UPDATE users SET 
        display_name = COALESCE($2, display_name),
        email = COALESCE($3, email),
        profile_image_url = COALESCE($4, profile_image_url),
        access_token = COALESCE($5, access_token),
        refresh_token = COALESCE($6, refresh_token),
        token_expires_at = COALESCE($7, token_expires_at),
        updated_at = CURRENT_TIMESTAMP,
        last_active_at = CURRENT_TIMESTAMP
      WHERE spotify_id = $1 
      RETURNING *`,
      [
        spotifyId, 
        display_name, 
        email, 
        profile_image_url, 
        access_token, 
        refresh_token, 
        token_expires_at
      ]
    );
    return result.rows[0];
  }

  // 更新最後活躍時間
  static async updateLastActive(spotifyId) {
    await query(
      'UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE spotify_id = $1',
      [spotifyId]
    );
  }

  // 更新 tokens
  static async updateTokens(spotifyId, accessToken, refreshToken, expiresIn) {
    const token_expires_at = new Date(Date.now() + expiresIn * 1000);
    
    const result = await query(
      `UPDATE users SET 
        access_token = $2,
        refresh_token = COALESCE($3, refresh_token),
        token_expires_at = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE spotify_id = $1 
      RETURNING *`,
      [spotifyId, accessToken, refreshToken, token_expires_at]
    );
    return result.rows[0];
  }

  // 檢查 token 是否即將過期
  static async getExpiringTokens(minutesBefore = 5) {
    const result = await query(
      `SELECT * FROM users 
       WHERE token_expires_at < NOW() + INTERVAL '${minutesBefore} minutes'
       AND refresh_token IS NOT NULL`,
      []
    );
    return result.rows;
  }

  // 根據 access token 查找用戶
  static async findByAccessToken(accessToken) {
    const result = await query(
      'SELECT * FROM users WHERE access_token = $1',
      [accessToken]
    );
    return result.rows[0] || null;
  }

  // 創建或更新用戶 (upsert)
  static async createOrUpdate(userData) {
    const existingUser = await this.findBySpotifyId(userData.spotify_id);
    
    if (existingUser) {
      return await this.update(userData.spotify_id, userData);
    } else {
      return await this.create(userData);
    }
  }
}

module.exports = User;