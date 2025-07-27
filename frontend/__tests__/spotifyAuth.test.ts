import AsyncStorage from '@react-native-async-storage/async-storage';
import { exchangeCodeForToken, getStoredAccessToken, logout } from '../services/spotifyAuth';

// Mock AsyncStorage
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

// Mock fetch
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('🔐 Spotify Auth Service 測試', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exchangeCodeForToken', () => {
    const mockTokenResponse = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_in: 3600,
      token_type: 'Bearer'
    };

    it('成功交換代碼應該儲存令牌', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse
      } as Response);

      mockAsyncStorage.setItem.mockResolvedValue();

      await exchangeCodeForToken('test-code', 'test-verifier');

      // 驗證 API 呼叫
      expect(mockFetch).toHaveBeenCalledWith(
        'https://accounts.spotify.com/api/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded'
          })
        })
      );

      // 驗證令牌儲存
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'spotify_access_token',
        'test-access-token'
      );
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'spotify_refresh_token',
        'test-refresh-token'
      );
    });

    it('API 錯誤應該拋出異常', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_grant' })
      } as Response);

      await expect(
        exchangeCodeForToken('invalid-code', 'test-verifier')
      ).rejects.toThrow('Failed to exchange code for token');
    });

    it('網路錯誤應該拋出異常', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        exchangeCodeForToken('test-code', 'test-verifier')
      ).rejects.toThrow('Network error');
    });
  });

  describe('getStoredAccessToken', () => {
    it('應該從 AsyncStorage 取得存取令牌', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('stored-access-token');

      const token = await getStoredAccessToken();

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('spotify_access_token');
      expect(token).toBe('stored-access-token');
    });

    it('沒有儲存的令牌應該回傳 null', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const token = await getStoredAccessToken();

      expect(token).toBeNull();
    });

    it('AsyncStorage 錯誤應該回傳 null', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));
      
      // 應該捕獲錯誤並回傳 null，不拋出異常
      const token = await getStoredAccessToken();
      
      expect(token).toBeNull();
    });
  });

  describe('logout', () => {
    it('應該清除所有儲存的令牌', async () => {
      mockAsyncStorage.removeItem.mockResolvedValue();

      await logout();

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('spotify_access_token');
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('spotify_refresh_token');
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('spotify_token_expires_at');
    });

    it('移除令牌失敗不應該拋出異常', async () => {
      mockAsyncStorage.removeItem.mockRejectedValue(new Error('Remove failed'));

      // 應該不拋出異常
      await expect(logout()).resolves.toBeUndefined();
    });
  });

  describe('令牌到期處理', () => {
    it('應該正確計算令牌到期時間', async () => {
      const currentTime = Date.now();
      const expiresIn = 3600; // 1 小時
      const expectedExpireTime = currentTime + (expiresIn * 1000);

      // 模擬 Date.now
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => currentTime);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_in: expiresIn
        })
      } as Response);

      mockAsyncStorage.setItem.mockResolvedValue();

      await exchangeCodeForToken('test-code', 'test-verifier');

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'spotify_token_expires_at',
        expectedExpireTime.toString()
      );

      // 恢復原始的 Date.now
      Date.now = originalDateNow;
    });
  });
});