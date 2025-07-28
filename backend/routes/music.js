const express = require('express');
const router = express.Router();
const axios = require('axios');
const { validate, schemas } = require('../middleware/validation');
const { musicFeatureCache, playbackHistoryCache } = require('../middleware/cache');

// 中間件：驗證 access token
const verifyToken = (req, res, next) => {
  const authorization = req.headers.authorization;
  
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      error: { code: 'MISSING_TOKEN', message: 'Access token is required' }
    });
  }

  req.accessToken = authorization.split(' ')[1];
  next();
};

// 獲取當前播放的歌曲
router.get('/current', verifyToken, async (req, res) => {
  try {
    const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { 'Authorization': `Bearer ${req.accessToken}` }
    });

    if (response.status === 204 || !response.data || !response.data.item) {
      return res.json({ 
        success: true, 
        data: { 
          is_playing: false, 
          track: null,
          message: 'No track currently playing'
        },
        timestamp: new Date().toISOString()
      });
    }

    const { item: track, is_playing, progress_ms, context } = response.data;

    const trackData = {
      spotify_track_id: track.id,
      name: track.name,
      artist: track.artists.map(artist => artist.name).join(', '),
      album: track.album.name,
      duration_ms: track.duration_ms,
      preview_url: track.preview_url,
      image_url: track.album.images && track.album.images.length > 0 ? track.album.images[0].url : null,
      external_url: track.external_urls.spotify,
      is_playing,
      progress_ms,
      context_type: context?.type || null,
      context_uri: context?.uri || null
    };

    res.json({ 
      success: true, 
      data: { track: trackData },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Get current track error:', err.response?.data || err.message);
    
    if (err.response?.status === 401) {
      res.status(401).json({ 
        success: false, 
        error: { code: 'INVALID_TOKEN', message: 'Access token has expired or is invalid' }
      });
    } else if (err.response?.status === 429) {
      res.status(429).json({ 
        success: false, 
        error: { code: 'RATE_LIMITED', message: 'Too many requests to Spotify API' }
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: { 
          code: 'TRACK_FETCH_FAILED', 
          message: 'Failed to fetch current track',
          details: err.response?.data || err.message
        }
      });
    }
  }
});

// 記錄播放資料
router.post('/playback', verifyToken, validate(schemas.playbackRecord), async (req, res) => {
  const { track_data, location, hex_id } = req.body;

  try {
    const User = require('../models/User');
    const Track = require('../models/Track');
    const Playback = require('../models/Playback');
    const HexProperty = require('../models/HexProperty');
    const HexTopTrack = require('../models/HexTopTrack');
    const MusicFeaturesService = require('../services/musicFeatures');

    // 1. 獲取當前用戶
    const user = await User.findByAccessToken(req.accessToken);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    // 2. 創建或獲取歌曲記錄
    const track = await Track.createOrGet(track_data);

    // 3. 檢查是否需要獲取音樂特徵
    const needsFeatures = !track.audio_features || !track.color_hex;
    
    if (needsFeatures) {
      // 異步獲取音樂特徵 (不阻塞主流程)
      setImmediate(async () => {
        try {
          await MusicFeaturesService.updateTrackFeatures(
            track.id, 
            track.spotify_track_id, 
            req.accessToken
          );
          console.log('音樂特徵已更新:', track.spotify_track_id);
        } catch (error) {
          console.error('獲取音樂特徵失敗:', error.message);
        }
      });
    }

    // 4. 檢查是否為重複播放 (30秒內同一首歌)
    const isDuplicate = await Playback.checkDuplicate(
      user.id, track.id, hex_id, 30
    );

    if (isDuplicate) {
      return res.json({ 
        success: true, 
        data: { 
          message: 'Duplicate playback ignored',
          hex_id,
          track_id: track.spotify_track_id
        },
        timestamp: new Date().toISOString()
      });
    }

    // 5. 記錄播放資料
    const playbackRecord = await Playback.create({
      user_id: user.id,
      track_id: track.id,
      hex_id,
      latitude: location.lat,
      longitude: location.lng,
      played_at: new Date(),
      progress_ms: track_data.progress_ms || 0,
      is_playing: track_data.is_playing !== false
    });

    // 6. 更新 hex_properties (如果需要)
    await HexProperty.createOrGet(hex_id, location.lat, location.lng);

    // 7. 更新 hex_top_tracks
    await HexTopTrack.createOrUpdate(hex_id, track.id, playbackRecord.played_at);

    // 8. 異步更新統計資料 (不阻塞回應)
    setImmediate(async () => {
      try {
        await HexProperty.updateStats(hex_id);
        await HexTopTrack.recalculateRankScores(hex_id);
        await User.updateLastActive(user.spotify_id);
        
        // 如果有音樂特徵，更新 hex 聚合特徵
        if (track.audio_features) {
          await HexProperty.updateAggregateFeatures(hex_id);
        }
      } catch (error) {
        console.error('Background stats update error:', error);
      }
    });

    console.log('Playback recorded:', {
      user: user.display_name,
      track: track.name,
      artist: track.artist,
      location: `${location.lat}, ${location.lng}`,
      hex_id,
      hasFeatures: !!track.audio_features
    });

    res.json({ 
      success: true, 
      data: { 
        message: 'Playback recorded successfully',
        hex_id,
        track_id: track.spotify_track_id,
        playback_id: playbackRecord.id,
        features_processing: needsFeatures
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Record playback error:', err);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'PLAYBACK_RECORD_FAILED', 
        message: 'Failed to record playback data',
        details: err.message
      }
    });
  }
});

// 獲取用戶播放歷史
router.get('/history', verifyToken, validate(schemas.pagination, 'query'), async (req, res) => {
  const { limit, offset } = req.query;

  try {
    const User = require('../models/User');
    const Playback = require('../models/Playback');

    // 獲取當前用戶
    const user = await User.findByAccessToken(req.accessToken);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    // 獲取播放歷史和總數
    const [tracks, total] = await Promise.all([
      Playback.getUserHistory(user.id, parseInt(limit), parseInt(offset)),
      Playback.getUserHistoryCount(user.id)
    ]);
    
    res.json({ 
      success: true, 
      data: { 
        tracks,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'HISTORY_FETCH_FAILED', 
        message: 'Failed to fetch playback history',
        details: err.message
      }
    });
  }
});

// 獲取歌曲詳細資訊
router.get('/tracks/:track_id', async (req, res) => {
  const { track_id } = req.params;

  try {
    const Track = require('../models/Track');
    const HexTopTrack = require('../models/HexTopTrack');

    // 獲取歌曲詳細資訊和統計
    const track = await Track.getDetailsWithStats(track_id);
    
    if (!track) {
      return res.status(404).json({ 
        success: false, 
        error: { code: 'TRACK_NOT_FOUND', message: 'Track not found' }
      });
    }

    // 獲取歌曲在不同 Hex 的表現
    const hexPerformance = await HexTopTrack.getTrackHexPerformance(track_id);

    // 找出表現最好的 Hex
    const topHex = hexPerformance.length > 0 ? hexPerformance[0] : null;
    
    res.json({ 
      success: true, 
      data: { 
        track,
        playback_stats: {
          total_plays: parseInt(track.total_plays) || 0,
          unique_users: parseInt(track.unique_users) || 0,
          unique_locations: parseInt(track.unique_locations) || 0,
          last_played_at: track.last_played_at,
          top_hex: topHex ? {
            hex_id: topHex.hex_id,
            center_lat: topHex.center_lat,
            center_lng: topHex.center_lng,
            play_count: topHex.play_count,
            rank_score: topHex.rank_score
          } : null
        },
        hex_performance: hexPerformance
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Get track details error:', err);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'TRACK_DETAILS_FAILED', 
        message: 'Failed to fetch track details',
        details: err.message
      }
    });
  }
});

module.exports = router;