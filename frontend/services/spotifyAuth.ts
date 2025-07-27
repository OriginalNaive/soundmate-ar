import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID!;
const REDIRECT_URI = Platform.select({
  web: makeRedirectUri({
    scheme: undefined,
    preferLocalhost: false,
  }),
  default: 'soundmate-ar://auth/spotify',
});

const SCOPES = [
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-top-read',
  'user-library-read',
];

export const useSpotifyAuth = () => {
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: SCOPES,
      usePKCE: true,
      redirectUri: REDIRECT_URI,
      responseType: 'code',
    },
    discovery
  );

  return {
    request,
    response,
    promptAsync,
  };
};

export const exchangeCodeForToken = async (code: string, codeVerifier: string) => {
  try {
    console.log('Token exchange parameters:', {
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier.substring(0, 20) + '...' // 只顯示前20字符
    });
    
    const body = `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_id=${encodeURIComponent(CLIENT_ID)}&code_verifier=${encodeURIComponent(codeVerifier)}`;
    
    console.log('Request body:', body);
    
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body,
    });

    const tokens = await response.json();
    console.log('Token exchange response:', response.status, tokens);
    
    if (!response.ok) {
      console.error('Token exchange failed with status:', response.status);
      console.error('Error details:', tokens);
      throw new Error(`Token exchange failed: ${tokens.error_description || tokens.error}`);
    }
    
    if (tokens.access_token) {
      await AsyncStorage.setItem('spotify_access_token', tokens.access_token);
      await AsyncStorage.setItem('spotify_refresh_token', tokens.refresh_token);
      await AsyncStorage.setItem('spotify_token_expiry', 
        (Date.now() + tokens.expires_in * 1000).toString()
      );
    }
    
    return tokens;
  } catch (error) {
    console.error('Token exchange failed:', error);
    throw error;
  }
};

export const getStoredAccessToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem('spotify_access_token');
    const expiry = await AsyncStorage.getItem('spotify_token_expiry');
    
    if (!token || !expiry) return null;
    
    if (Date.now() > parseInt(expiry)) {
      await refreshAccessToken();
      return await AsyncStorage.getItem('spotify_access_token');
    }
    
    return token;
  } catch (error) {
    console.error('Failed to get stored token:', error);
    return null;
  }
};

export const refreshAccessToken = async (): Promise<void> => {
  try {
    const refreshToken = await AsyncStorage.getItem('spotify_refresh_token');
    if (!refreshToken) throw new Error('No refresh token available');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
      }),
    });

    const tokens = await response.json();
    
    if (tokens.access_token) {
      await AsyncStorage.setItem('spotify_access_token', tokens.access_token);
      await AsyncStorage.setItem('spotify_token_expiry', 
        (Date.now() + tokens.expires_in * 1000).toString()
      );
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw error;
  }
};

export const logout = async (): Promise<void> => {
  await AsyncStorage.multiRemove([
    'spotify_access_token',
    'spotify_refresh_token',
    'spotify_token_expiry'
  ]);
};