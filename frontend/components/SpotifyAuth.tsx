import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { useSpotifyAuth, exchangeCodeForToken, getStoredAccessToken, logout } from '../services/spotifyAuth';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

export default function SpotifyAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const { request, response, promptAsync } = useSpotifyAuth();

  useEffect(() => {
    checkAuthStatus();
  }, []);
  
  useEffect(() => {
    // 檢查網頁版的回調參數，但等待 request 準備完成
    if (Platform.OS === 'web' && request) {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      
      if (code) {
        console.log('Found auth code in URL:', code);
        console.log('Request object ready, codeVerifier:', request.codeVerifier);
        handleUrlCallback(code);
      }
    }
  }, [request]); // 依賴於 request 物件
  
  const handleUrlCallback = async (code: string) => {
    try {
      if (request?.codeVerifier) {
        console.log('Processing URL callback with code:', code);
        await exchangeCodeForToken(code, request.codeVerifier);
        setIsAuthenticated(true);
        await checkAuthStatus();
        Alert.alert('Success', 'Successfully connected to Spotify!');
        
        // 清理 URL 參數
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (error) {
      console.error('URL callback failed:', error);
      Alert.alert('Error', 'Failed to connect to Spotify');
    }
  };

  useEffect(() => {
    console.log('Auth response received:', response);
    if (response?.type === 'success') {
      console.log('Auth success detected, calling handleAuthSuccess');
      handleAuthSuccess(response);
    } else if (response?.type === 'error') {
      console.log('Auth error:', response.error);
    }
  }, [response]);

  const checkAuthStatus = async () => {
    try {
      const token = await getStoredAccessToken();
      setIsAuthenticated(!!token);
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = async (authResponse: any) => {
    try {
      console.log('Auth response:', authResponse);
      if (authResponse.params.code && request?.codeVerifier) {
        console.log('Exchanging code for token...');
        await exchangeCodeForToken(authResponse.params.code, request.codeVerifier);
        console.log('Token exchange successful');
        setIsAuthenticated(true);
        await checkAuthStatus(); // 重新檢查狀態
        Alert.alert('Success', 'Successfully connected to Spotify!');
      } else {
        console.log('Missing code or codeVerifier:', { 
          code: authResponse.params.code, 
          codeVerifier: request?.codeVerifier 
        });
      }
    } catch (error) {
      console.error('Auth exchange failed:', error);
      Alert.alert('Error', 'Failed to connect to Spotify');
    }
  };

  const handleLogin = async () => {
    try {
      console.log('Redirect URI:', request?.redirectUri);
      
      if (Platform.OS === 'web') {
        // 網頁版使用直接重定向
        const authUrl = request?.url;
        if (authUrl) {
          console.log('Redirecting to:', authUrl);
          window.location.href = authUrl;
        }
      } else {
        // 移動設備使用 promptAsync
        await promptAsync();
      }
    } catch (error) {
      console.error('Login failed:', error);
      Alert.alert('Error', 'Failed to start Spotify login');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsAuthenticated(false);
      Alert.alert('Success', 'Logged out from Spotify');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Checking Spotify connection...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isAuthenticated ? (
        <View style={styles.content}>
          <Text style={styles.text}>✅ Connected to Spotify</Text>
          <TouchableOpacity style={styles.button} onPress={handleLogout}>
            <Text style={styles.buttonText}>Disconnect Spotify</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.text}>Connect your Spotify account to get started</Text>
          <TouchableOpacity 
            style={[styles.button, styles.spotifyButton]} 
            onPress={handleLogin}
            disabled={!request}
          >
            <Text style={styles.buttonText}>Connect Spotify</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    gap: 20,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 200,
  },
  spotifyButton: {
    backgroundColor: '#1DB954',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});