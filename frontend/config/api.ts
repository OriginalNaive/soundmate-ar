// API 配置文件
import { Platform } from 'react-native';

// 開發環境配置
const DEV_CONFIG = {
  // 在真機上使用電腦IP，在模擬器上使用localhost
  HOST: Platform.OS === 'ios' || Platform.OS === 'android' ? '192.168.1.106' : 'localhost',
  PORT: '5000'
};

// API 基礎URL
export const API_BASE_URL = `http://${DEV_CONFIG.HOST}:${DEV_CONFIG.PORT}/api`;

// API 端點
export const API_ENDPOINTS = {
  HEALTH: '/health',
  MAP_HEXAGONS: '/map/data',
  MAP_HEX_DETAILS: (hexId: string) => `/map/hex/${hexId}`,
  MAP_HEX_TRACKS: (hexId: string) => `/map/hex/${hexId}/tracks`,
  LOCATION_UPDATE: '/location/update',
  MUSIC_PLAYBACK: '/music/playback',
  STATS: '/stats'
};

// 網路請求配置
export const REQUEST_CONFIG = {
  TIMEOUT: 10000, // 10秒超時
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000 // 1秒重試延遲
};

// 網路請求錯誤處理
export const handleNetworkError = (error: any) => {
  console.error('Network request failed:', error);
  
  if (error.message === 'Network request failed') {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: '無法連接到服務器，請檢查網路連接',
        details: `嘗試連接到 ${API_BASE_URL}`
      }
    };
  }
  
  return {
    success: false,
    error: {
      code: 'REQUEST_ERROR',
      message: error.message || '請求失敗'
    }
  };
};

// 帶重試的fetch函數
export const fetchWithRetry = async (url: string, options: any = {}, retries = REQUEST_CONFIG.RETRY_ATTEMPTS): Promise<any> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_CONFIG.TIMEOUT);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    if (retries > 0 && error.name !== 'AbortError') {
      console.log(`Retrying request to ${url}, attempts left: ${retries - 1}`);
      await new Promise(resolve => setTimeout(resolve, REQUEST_CONFIG.RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
};

console.log('🌐 API配置初始化:', {
  baseUrl: API_BASE_URL,
  platform: Platform.OS,
  host: DEV_CONFIG.HOST,
  port: DEV_CONFIG.PORT
});