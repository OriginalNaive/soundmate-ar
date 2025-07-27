import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// 完成 WebBrowser 認證會話
WebBrowser.maybeCompleteAuthSession();

class AuthService {
  // Spotify OAuth 登入
  static async loginWithSpotify() {
    try {
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'soundmate-ar',
        useProxy: true,
      });

      console.log('Redirect URI:', redirectUri);

      // 建構授權 URL
      const authUrl = `${API_BASE_URL}/auth/spotify/login`;
      
      // 啟動認證會話
      const result = await AuthSession.startAsync({
        authUrl: authUrl,
        returnUrl: redirectUri,
      });

      if (result.type === 'success') {
        // 檢查 URL 中是否包含 callback 參數
        if (result.url.includes('/callback')) {
          return await this.handleAuthCallback(result.url);
        } else {
          throw new Error('Invalid callback URL');
        }
      } else {
        throw new Error('Authentication cancelled or failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // 處理認證回調
  static async handleAuthCallback(callbackUrl) {
    try {
      // 解析 URL 參數
      const url = new URL(callbackUrl);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        throw new Error(`Spotify authorization error: ${error}`);
      }

      if (!code) {
        throw new Error('No authorization code received');
      }

      // 使用授權碼交換 token
      const response = await axios.get(`${API_BASE_URL}/auth/spotify/callback`, {
        params: { code }
      });

      if (response.data.success) {
        const { access_token, refresh_token, user } = response.data.data;
        
        // 儲存 tokens 和用戶資料
        await this.saveAuthData(access_token, refresh_token, user);
        
        return { success: true, user };
      } else {
        throw new Error('Failed to exchange authorization code');
      }
    } catch (error) {
      console.error('Callback handling error:', error);
      throw error;
    }
  }

  // 儲存認證資料
  static async saveAuthData(accessToken, refreshToken, user) {
    try {
      await AsyncStorage.multiSet([
        ['spotify_access_token', accessToken],
        ['spotify_refresh_token', refreshToken],
        ['user_data', JSON.stringify(user)],
        ['token_saved_at', Date.now().toString()]
      ]);
    } catch (error) {
      console.error('Save auth data error:', error);
      throw error;
    }
  }

  // 獲取儲存的認證資料
  static async getAuthData() {
    try {
      const [accessToken, refreshToken, userData, savedAt] = await AsyncStorage.multiGet([
        'spotify_access_token',
        'spotify_refresh_token', 
        'user_data',
        'token_saved_at'
      ]);

      if (!accessToken[1] || !userData[1]) {
        return null;
      }

      return {
        accessToken: accessToken[1],
        refreshToken: refreshToken[1],
        user: JSON.parse(userData[1]),
        savedAt: parseInt(savedAt[1]) || 0
      };
    } catch (error) {
      console.error('Get auth data error:', error);
      return null;
    }
  }

  // 檢查 token 是否需要刷新
  static async checkAndRefreshToken() {
    try {
      const authData = await this.getAuthData();
      if (!authData) return null;

      // 檢查是否需要刷新 (token 儲存超過 50 分鐘)
      const tokenAge = Date.now() - authData.savedAt;
      const fiftyMinutes = 50 * 60 * 1000;

      if (tokenAge > fiftyMinutes && authData.refreshToken) {
        console.log('Token需要刷新');
        return await this.refreshToken(authData.refreshToken);
      }

      return authData;
    } catch (error) {
      console.error('Check token error:', error);
      return null;
    }
  }

  // 刷新 access token
  static async refreshToken(refreshToken) {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/spotify/refresh`, {
        refresh_token: refreshToken
      });

      if (response.data.success) {
        const { access_token, refresh_token: newRefreshToken } = response.data.data;
        
        // 更新儲存的 tokens
        await AsyncStorage.multiSet([
          ['spotify_access_token', access_token],
          ['spotify_refresh_token', newRefreshToken || refreshToken],
          ['token_saved_at', Date.now().toString()]
        ]);

        const userData = await AsyncStorage.getItem('user_data');
        
        return {
          accessToken: access_token,
          refreshToken: newRefreshToken || refreshToken,
          user: userData ? JSON.parse(userData) : null,
          savedAt: Date.now()
        };
      } else {
        throw new Error('Failed to refresh token');
      }
    } catch (error) {
      console.error('Refresh token error:', error);
      // Token 刷新失敗，清除認證資料
      await this.logout();
      throw error;
    }
  }

  // 獲取當前用戶
  static async getCurrentUser() {
    try {
      const authData = await this.checkAndRefreshToken();
      if (!authData) return null;

      const response = await axios.get(`${API_BASE_URL}/auth/spotify/me`, {
        headers: { Authorization: `Bearer ${authData.accessToken}` }
      });

      if (response.data.success) {
        // 更新本地用戶資料
        await AsyncStorage.setItem('user_data', JSON.stringify(response.data.data.user));
        return response.data.data.user;
      } else {
        throw new Error('Failed to get current user');
      }
    } catch (error) {
      console.error('Get current user error:', error);
      if (error.response?.status === 401) {
        // Token 無效，清除認證資料
        await this.logout();
      }
      return null;
    }
  }

  // 登出
  static async logout() {
    try {
      const authData = await this.getAuthData();
      
      // 通知後端登出
      if (authData?.accessToken) {
        try {
          await axios.post(`${API_BASE_URL}/auth/spotify/logout`, {}, {
            headers: { Authorization: `Bearer ${authData.accessToken}` }
          });
        } catch (error) {
          console.log('Backend logout notification failed:', error);
        }
      }

      // 清除本地儲存
      await AsyncStorage.multiRemove([
        'spotify_access_token',
        'spotify_refresh_token',
        'user_data',
        'token_saved_at'
      ]);

      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  // 檢查是否已登入
  static async isLoggedIn() {
    try {
      const authData = await this.checkAndRefreshToken();
      return authData !== null;
    } catch (error) {
      console.error('Check login status error:', error);
      return false;
    }
  }

  // 獲取有效的 access token
  static async getValidAccessToken() {
    try {
      const authData = await this.checkAndRefreshToken();
      return authData?.accessToken || null;
    } catch (error) {
      console.error('Get valid access token error:', error);
      return null;
    }
  }
}

export default AuthService;