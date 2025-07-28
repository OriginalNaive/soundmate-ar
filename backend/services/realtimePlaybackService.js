const axios = require('axios');
const { logger } = require('../config/logger');
const { query } = require('../config/database');
const User = require('../models/User');
const Playback = require('../models/Playback');
const musicFeatures = require('./musicFeatures');
const h3 = require('h3-js');

class RealtimePlaybackService {
  constructor() {
    this.activeUsers = new Map(); // 儲存活躍用戶的播放狀態
    this.pollInterval = 30000; // 30秒輪詢一次
    this.isRunning = false;
    
    logger.info('即時播放狀態服務已初始化');
  }

  /**
   * 啟動服務
   */
  start() {
    if (this.isRunning) {
      logger.warn('即時播放狀態服務已在運行');
      return;
    }

    this.isRunning = true;
    this.pollActiveUsers();
    logger.info('即時播放狀態服務已啟動', { 
      pollInterval: this.pollInterval 
    });
  }

  /**
   * 停止服務
   */
  stop() {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    logger.info('即時播放狀態服務已停止');
  }

  /**
   * 添加活躍用戶
   * @param {string} userId - 用戶 ID
   * @param {string} accessToken - Spotify access token
   */
  addActiveUser(userId, accessToken) {
    this.activeUsers.set(userId, {
      accessToken,
      lastCheck: Date.now(),
      lastTrack: null
    });
    
    logger.debug('添加活躍用戶', { userId, activeUsersCount: this.activeUsers.size });
  }

  /**
   * 移除活躍用戶
   * @param {string} userId - 用戶 ID
   */
  removeActiveUser(userId) {
    const removed = this.activeUsers.delete(userId);
    if (removed) {
      logger.debug('移除活躍用戶', { userId, activeUsersCount: this.activeUsers.size });
    }
  }

  /**
   * 輪詢活躍用戶的播放狀態
   */
  async pollActiveUsers() {
    if (!this.isRunning) return;

    try {
      const promises = Array.from(this.activeUsers.entries()).map(
        ([userId, userData]) => this.checkUserPlayback(userId, userData)
      );
      
      await Promise.allSettled(promises);
      
      logger.debug('完成所有用戶播放狀態檢查', { 
        activeUsersCount: this.activeUsers.size 
      });
    } catch (error) {
      logger.error('輪詢用戶播放狀態失敗', { error: error.message });
    }

    // 設置下次輪詢
    if (this.isRunning) {
      this.pollTimer = setTimeout(() => {
        this.pollActiveUsers();
      }, this.pollInterval);
    }
  }

  /**
   * 檢查單個用戶的播放狀態
   * @param {string} userId - 用戶 ID
   * @param {Object} userData - 用戶數據
   */
  async checkUserPlayback(userId, userData) {
    try {
      const currentTrack = await this.getCurrentTrack(userData.accessToken);
      
      if (!currentTrack) {
        logger.debug('用戶當前未播放音樂', { userId });
        return;
      }

      // 檢查是否為新歌曲
      const trackId = currentTrack.id;
      if (userData.lastTrack?.id !== trackId) {
        logger.info('檢測到新歌曲播放', { 
          userId, 
          trackId, 
          trackName: currentTrack.name,
          artist: currentTrack.artists[0]?.name 
        });

        // 記錄播放
        await this.recordPlayback(userId, currentTrack);
        
        // 更新用戶最後播放記錄
        userData.lastTrack = currentTrack;
      }

      userData.lastCheck = Date.now();
      
    } catch (error) {
      logger.error('檢查用戶播放狀態失敗', { 
        userId, 
        error: error.message 
      });

      // 如果是認證錯誤，移除該用戶
      if (error.response?.status === 401) {
        logger.warn('用戶認證失效，移除活躍用戶', { userId });
        this.removeActiveUser(userId);
      }
    }
  }

  /**
   * 獲取當前播放的歌曲
   * @param {string} accessToken - Spotify access token
   * @returns {Object|null} 當前播放的歌曲信息
   */
  async getCurrentTrack(accessToken) {
    try {
      const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 5000
      });

      if (response.status === 204 || !response.data?.item) {
        return null; // 沒有正在播放的音樂
      }

      const track = response.data.item;
      return {
        id: track.id,
        name: track.name,
        artists: track.artists,
        album: track.album,
        duration_ms: track.duration_ms,
        progress_ms: response.data.progress_ms,
        is_playing: response.data.is_playing
      };
      
    } catch (error) {
      if (error.response?.status === 204) {
        return null; // 沒有正在播放的音樂
      }
      throw error;
    }
  }

  /**
   * 記錄播放到資料庫
   * @param {string} userId - 用戶 ID
   * @param {Object} track - 歌曲信息
   */
  async recordPlayback(userId, track) {
    try {
      // 獲取用戶位置信息
      const user = await User.findById(userId);
      if (!user || !user.latitude || !user.longitude) {
        logger.warn('用戶位置信息不完整，跳過播放記錄', { userId });
        return;
      }

      // 計算 H3 hex
      const hexId = h3.latLngToCell(
        user.latitude, 
        user.longitude, 
        parseInt(process.env.H3_RESOLUTION) || 9
      );

      // 獲取音樂特徵
      let audioFeatures = null;
      try {
        // 這裡需要有效的 access token 來獲取音樂特徵
        const featuresResponse = await axios.get(
          `https://api.spotify.com/v1/audio-features/${track.id}`,
          {
            headers: { 'Authorization': `Bearer ${this.activeUsers.get(userId).accessToken}` }
          }
        );
        audioFeatures = featuresResponse.data;
      } catch (error) {
        logger.warn('獲取音樂特徵失敗', { trackId: track.id, error: error.message });
      }

      // 創建播放記錄
      const playbackData = {
        user_id: userId,
        track_id: track.id,
        track_name: track.name,
        artist_name: track.artists[0]?.name || 'Unknown Artist',
        album_name: track.album?.name || 'Unknown Album',
        duration_ms: track.duration_ms,
        hex_id: hexId,
        latitude: user.latitude,
        longitude: user.longitude,
        played_at: new Date(),
        audio_features: audioFeatures
      };

      await Playback.create(playbackData);

      // 處理音樂特徵
      if (audioFeatures) {
        await musicFeatures.processTrackFeatures(track.id, audioFeatures);
      }

      logger.info('播放記錄已創建', { 
        userId, 
        trackId: track.id, 
        hexId,
        trackName: track.name 
      });

    } catch (error) {
      logger.error('記錄播放失敗', { 
        userId, 
        trackId: track.id, 
        error: error.message 
      });
    }
  }

  /**
   * 獲取服務狀態
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeUsersCount: this.activeUsers.size,
      pollInterval: this.pollInterval,
      lastPollTime: this.lastPollTime
    };
  }

  /**
   * 手動觸發用戶播放狀態檢查
   * @param {string} userId - 用戶 ID
   */
  async triggerUserCheck(userId) {
    const userData = this.activeUsers.get(userId);
    if (!userData) {
      throw new Error('用戶不在活躍列表中');
    }

    await this.checkUserPlayback(userId, userData);
    logger.info('手動觸發用戶播放檢查完成', { userId });
  }
}

// 創建單例實例
const realtimePlaybackService = new RealtimePlaybackService();

// 優雅關閉處理
process.on('SIGTERM', () => {
  realtimePlaybackService.stop();
});

process.on('SIGINT', () => {
  realtimePlaybackService.stop();
});

module.exports = realtimePlaybackService;