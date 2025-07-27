const express = require('express');
const router = express.Router();
const axios = require('axios');
const { validate, schemas } = require('../middleware/validation');

// Spotify 登入授權
router.get('/login', (req, res) => {
  const scope = 'user-read-currently-playing user-read-playback-state user-read-email user-read-private';
  const redirect_uri = process.env.SPOTIFY_REDIRECT_URI;
  const client_id = process.env.SPOTIFY_CLIENT_ID;

  if (!client_id || !redirect_uri) {
    return res.status(500).json({ 
      success: false, 
      error: { code: 'MISSING_CONFIG', message: 'Spotify configuration missing' }
    });
  }

  const authURL = `https://accounts.spotify.com/authorize?response_type=code&client_id=${client_id}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirect_uri)}&show_dialog=true`;
  res.redirect(authURL);
});

// Spotify callback 取得 access_token 和用戶資料
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    return res.status(400).json({ 
      success: false, 
      error: { code: 'AUTH_DENIED', message: 'User denied authorization', details: error }
    });
  }

  if (!code) {
    return res.status(400).json({ 
      success: false, 
      error: { code: 'MISSING_CODE', message: 'Authorization code missing' }
    });
  }

  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI } = process.env;
  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

  try {
    // 獲取 access token
    const tokenResponse = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`,
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // 獲取用戶資料
    const userResponse = await axios.get('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    const user = userResponse.data;
    const userData = {
      spotify_id: user.id,
      display_name: user.display_name,
      email: user.email,
      profile_image_url: user.images && user.images.length > 0 ? user.images[0].url : null,
    };

    // 儲存用戶資料到資料庫
    const User = require('../models/User');
    const savedUser = await User.createOrUpdate({
      ...userData,
      access_token,
      refresh_token,
      expires_in
    });

    res.json({ 
      success: true, 
      data: {
        access_token, 
        refresh_token, 
        expires_in,
        user: {
          id: savedUser.id,
          spotify_id: savedUser.spotify_id,
          display_name: savedUser.display_name,
          email: savedUser.email,
          profile_image_url: savedUser.profile_image_url
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Spotify callback error:', err.response?.data || err.message);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'TOKEN_EXCHANGE_FAILED', 
        message: 'Failed to exchange authorization code',
        details: err.response?.data?.error_description || err.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 刷新 access token
router.post('/refresh', validate(schemas.refreshToken), async (req, res) => {
  const { refresh_token } = req.body;

  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`,
        },
      }
    );

    const { access_token, expires_in, refresh_token: new_refresh_token } = response.data;

    res.json({ 
      success: true, 
      data: {
        access_token, 
        expires_in,
        refresh_token: new_refresh_token || refresh_token // 有些情況下不會返回新的 refresh_token
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Token refresh error:', err.response?.data || err.message);
    res.status(401).json({ 
      success: false, 
      error: { 
        code: 'REFRESH_FAILED', 
        message: 'Failed to refresh access token',
        details: err.response?.data?.error_description || err.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 獲取當前用戶資訊
router.get('/me', async (req, res) => {
  const authorization = req.headers.authorization;
  
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      error: { code: 'MISSING_TOKEN', message: 'Access token is required' }
    });
  }

  const access_token = authorization.split(' ')[1];

  try {
    const response = await axios.get('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    res.json({ 
      success: true, 
      data: { user: response.data },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Get user error:', err.response?.data || err.message);
    
    if (err.response?.status === 401) {
      res.status(401).json({ 
        success: false, 
        error: { code: 'INVALID_TOKEN', message: 'Access token has expired or is invalid' }
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: { 
          code: 'USER_FETCH_FAILED', 
          message: 'Failed to fetch user information',
          details: err.response?.data || err.message
        }
      });
    }
  }
});

// 登出用戶
router.post('/logout', async (req, res) => {
  try {
    const authorization = req.headers.authorization;
    
    if (authorization && authorization.startsWith('Bearer ')) {
      const accessToken = authorization.split(' ')[1];
      const User = require('../models/User');
      
      // 可以選擇清除用戶的 access token (使其失效)
      const user = await User.findByAccessToken(accessToken);
      if (user) {
        await User.updateTokens(user.spotify_id, null, user.refresh_token, 0);
      }
    }

    res.json({ 
      success: true, 
      data: { message: 'Logged out successfully' },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.json({ 
      success: true, 
      data: { message: 'Logged out successfully' },
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;