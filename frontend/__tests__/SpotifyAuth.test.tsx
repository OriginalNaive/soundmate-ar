import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import SpotifyAuth from '../components/SpotifyAuth';
import * as spotifyAuth from '../services/spotifyAuth';

// Mock the Spotify auth service
jest.mock('../services/spotifyAuth', () => ({
  useSpotifyAuth: jest.fn(),
  exchangeCodeForToken: jest.fn(),
  getStoredAccessToken: jest.fn(),
  logout: jest.fn()
}));

// Mock Alert
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Alert: {
      alert: jest.fn()
    },
    Platform: {
      OS: 'ios'
    }
  };
});

const mockedSpotifyAuth = spotifyAuth as jest.Mocked<typeof spotifyAuth>;

describe('🎵 SpotifyAuth 組件測試', () => {
  const mockRequest = {
    url: 'https://accounts.spotify.com/authorize?...',
    codeVerifier: 'test-code-verifier',
    redirectUri: 'http://localhost:3000'
  };

  const mockResponse = {
    type: 'success',
    params: {
      code: 'test-auth-code'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 設定預設的 mock 回傳值
    mockedSpotifyAuth.useSpotifyAuth.mockReturnValue({
      request: mockRequest,
      response: null,
      promptAsync: jest.fn()
    });
    mockedSpotifyAuth.getStoredAccessToken.mockResolvedValue(null);
  });

  describe('未認證狀態', () => {
    it('應該顯示連接 Spotify 按鈕', async () => {
      render(<SpotifyAuth />);
      
      await waitFor(() => {
        expect(screen.getByText('Connect your Spotify account to get started')).toBeTruthy();
        expect(screen.getByText('Connect Spotify')).toBeTruthy();
      });
    });

    it('點擊連接按鈕應該觸發登入流程', async () => {
      const mockPromptAsync = jest.fn();
      mockedSpotifyAuth.useSpotifyAuth.mockReturnValue({
        request: mockRequest,
        response: null,
        promptAsync: mockPromptAsync
      });

      render(<SpotifyAuth />);
      
      await waitFor(() => {
        const connectButton = screen.getByText('Connect Spotify');
        fireEvent.press(connectButton);
        
        // 在非 web 平台應該呼叫 promptAsync
        expect(mockPromptAsync).toHaveBeenCalled();
      });
    });
  });

  describe('已認證狀態', () => {
    beforeEach(() => {
      // 模擬已有存取令牌
      mockedSpotifyAuth.getStoredAccessToken.mockResolvedValue('mock-access-token');
    });

    it('應該顯示已連接狀態', async () => {
      render(<SpotifyAuth />);
      
      await waitFor(() => {
        expect(screen.getByText('✅ Connected to Spotify')).toBeTruthy();
        expect(screen.getByText('Disconnect Spotify')).toBeTruthy();
      });
    });

    it('點擊斷開連接應該執行登出', async () => {
      mockedSpotifyAuth.logout.mockResolvedValue();
      
      render(<SpotifyAuth />);
      
      await waitFor(() => {
        const disconnectButton = screen.getByText('Disconnect Spotify');
        fireEvent.press(disconnectButton);
      });

      await waitFor(() => {
        expect(mockedSpotifyAuth.logout).toHaveBeenCalled();
      });
    });
  });

  describe('載入狀態', () => {
    it('應該顯示載入訊息', async () => {
      // 模擬 getStoredAccessToken 持續執行
      mockedSpotifyAuth.getStoredAccessToken.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(null), 1000))
      );

      render(<SpotifyAuth />);
      
      expect(screen.getByText('Checking Spotify connection...')).toBeTruthy();
    });
  });

  describe('認證回調處理', () => {
    it('成功的認證回應應該交換代碼取得令牌', async () => {
      mockedSpotifyAuth.exchangeCodeForToken.mockResolvedValue();
      
      // 模擬收到成功的認證回應
      mockedSpotifyAuth.useSpotifyAuth.mockReturnValue({
        request: mockRequest,
        response: mockResponse,
        promptAsync: jest.fn()
      });

      render(<SpotifyAuth />);
      
      await waitFor(() => {
        expect(mockedSpotifyAuth.exchangeCodeForToken).toHaveBeenCalledWith(
          'test-auth-code',
          'test-code-verifier'
        );
      });
    });

    it('交換代碼失敗應該顯示錯誤', async () => {
      const { Alert } = require('react-native');
      mockedSpotifyAuth.exchangeCodeForToken.mockRejectedValue(
        new Error('Token exchange failed')
      );
      
      mockedSpotifyAuth.useSpotifyAuth.mockReturnValue({
        request: mockRequest,
        response: mockResponse,
        promptAsync: jest.fn()
      });

      render(<SpotifyAuth />);
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to connect to Spotify');
      });
    });
  });

  describe('Web 平台特定行為', () => {
    beforeEach(() => {
      // 模擬 web 平台
      require('react-native').Platform.OS = 'web';
      
      // 模擬 window 物件
      Object.defineProperty(window, 'location', {
        value: {
          search: '?code=test-code&state=test-state',
          pathname: '/test'
        },
        writable: true
      });

      Object.defineProperty(window, 'history', {
        value: {
          replaceState: jest.fn()
        },
        writable: true
      });
    });

    it('Web 平台應該檢查 URL 參數中的認證代碼', async () => {
      mockedSpotifyAuth.exchangeCodeForToken.mockResolvedValue();
      
      render(<SpotifyAuth />);
      
      await waitFor(() => {
        expect(mockedSpotifyAuth.exchangeCodeForToken).toHaveBeenCalledWith(
          'test-code',
          'test-code-verifier'
        );
      });
    });
  });
});