import React, { useState, useEffect } from 'react';
import { Image } from 'expo-image';
import { Platform, StyleSheet, View, Button, Text, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import axios from 'axios';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import SpotifyAuth from '@/components/SpotifyAuth';
import { getStoredAccessToken } from '@/services/spotifyAuth';
import { API_BASE_URL, fetchWithRetry, handleNetworkError } from '@/config/api';

export default function HomeScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [currentHex, setCurrentHex] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<any>(null);

  // 檢查登入狀態和自動獲取位置
  useEffect(() => {
    checkAuthStatus();
    getLocation(); // 自動獲取位置
  }, []);

  // 定期更新播放狀態
  useEffect(() => {
    if (user) {
      const interval = setInterval(updateCurrentTrack, 30000); // 每 30 秒更新
      updateCurrentTrack(); // 立即執行一次
      return () => clearInterval(interval);
    }
  }, [user]);

  const syncUserToBackend = async (accessToken: string, userData: any) => {
    try {
      console.log('正在同步用戶資訊到後端...');
      const response = await axios.post(`${API_BASE_URL}/auth/spotify/sync`, {
        user_data: {
          spotify_id: userData.id,
          display_name: userData.display_name,
          email: userData.email,
          profile_image_url: userData.images?.[0]?.url || null
        },
        access_token: accessToken
      });
      
      if (response.data.success) {
        console.log('✅ 用戶資訊同步成功');
      } else {
        console.log('❌ 用戶資訊同步失敗:', response.data.error);
      }
    } catch (error: any) {
      console.log('❌ 用戶同步 API 調用失敗:', error.response?.data || error.message);
    }
  };

  const checkAuthStatus = async () => {
    try {
      const token = await getStoredAccessToken();
      if (token) {
        // 獲取用戶資料
        const response = await fetch('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          console.log('用戶已登入:', userData.display_name);
          
          // 同步用戶資訊到後端數據庫
          await syncUserToBackend(token, userData);
        }
      }
    } catch (error) {
      console.error('檢查登入狀態失敗:', error);
    }
  };


  const getLocation = async () => {
    try {
      setIsLoading(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('權限被拒絕', '需要位置權限才能使用此功能');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      setLocation(loc.coords);

      // 更新位置到後端
      try {
        console.log('正在更新位置到後端:', { lat: loc.coords.latitude, lng: loc.coords.longitude });
        const response = await axios.post(`${API_BASE_URL}/location/update`, {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude
        });

        if (response.data.success) {
          setCurrentHex(response.data.data.hex_id);
          console.log('✅ 位置更新成功，獲得 hex_id:', response.data.data.hex_id);
        } else {
          console.log('❌ 位置更新 API 回應失敗:', response.data);
        }
      } catch (apiError: any) {
        console.log('❌ 後端位置 API 調用失敗:', apiError.response?.data || apiError.message);
        
        // 作為備用方案，在前端計算 hex_id
        try {
          const h3 = await import('h3-js');
          const hexId = h3.latLngToCell(loc.coords.latitude, loc.coords.longitude, 9);
          setCurrentHex(hexId);
          console.log('✅ 使用前端計算的 hex_id:', hexId);
        } catch (h3Error) {
          console.error('前端 H3 計算也失敗:', h3Error);
        }
      }
    } catch (error) {
      console.error('獲取位置失敗:', error);
      Alert.alert('錯誤', '無法獲取位置權限或位置服務');
    } finally {
      setIsLoading(false);
    }
  };

  const updateCurrentTrack = async () => {
    try {
      const accessToken = await getStoredAccessToken();
      if (!accessToken) {
        console.log('沒有 Spotify access token');
        return;
      }

      console.log('正在獲取當前播放狀態...');
      const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      console.log('Spotify API 回應狀態:', response.status);

      if (response.ok && response.status !== 204) {
        const data = await response.json();
        console.log('Spotify 當前播放資料:', data);
        if (data.item) {
          const track = {
            id: data.item.id,
            name: data.item.name,
            artist: data.item.artists[0]?.name,
            album: data.item.album.name,
            image_url: data.item.album.images[0]?.url
          };
          console.log('設定當前播放歌曲:', track);
          setCurrentTrack(track);
          
          // 如果有位置和歌曲，記錄播放資料
          if (location && currentHex) {
            console.log('準備記錄播放資料:', { track: track.name, location, currentHex });
            await recordPlayback(track);
          } else {
            console.log('缺少記錄播放所需資料:', { hasLocation: !!location, hasCurrentHex: !!currentHex });
          }
        } else {
          console.log('沒有正在播放的歌曲');
          setCurrentTrack(null);
        }
      } else {
        console.log('沒有當前播放的歌曲或 Spotify 未打開');
        setCurrentTrack(null);
      }
    } catch (error) {
      console.error('獲取當前播放失敗:', error);
    }
  };

  const recordPlayback = async (track: any) => {
    try {
      const accessToken = await getStoredAccessToken();
      if (!accessToken || !location || !currentHex) return;

      await axios.post(`${API_BASE_URL}/music/playback`, {
        track_data: track,
        location: {
          lat: location.latitude,
          lng: location.longitude
        },
        hex_id: currentHex
      }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      console.log('播放記錄已儲存');
    } catch (error) {
      console.error('記錄播放失敗:', error);
    }
  };

  const logout = async () => {
    try {
      const { logout } = await import('@/services/spotifyAuth');
      await logout();
      setUser(null);
      setCurrentTrack(null);
      Alert.alert('成功', '已登出');
    } catch (error) {
      console.error('登出失敗:', error);
      Alert.alert('錯誤', '登出時發生問題');
    }
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">SoundMate AR</ThemedText>
        <HelloWave />
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <SpotifyAuth />
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">位置資訊</ThemedText>
        {location ? (
          <View>
            <Text>緯度: {location.latitude.toFixed(6)}</Text>
            <Text>經度: {location.longitude.toFixed(6)}</Text>
            {currentHex && <Text>Hex ID: {currentHex}</Text>}
          </View>
        ) : (
          <ThemedText>尚未獲取位置</ThemedText>
        )}
        {isLoading ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <Button title="取得位置" onPress={getLocation} />
        )}
      </ThemedView>

      {currentTrack && (
        <ThemedView style={styles.stepContainer}>
          <ThemedText type="subtitle">正在播放</ThemedText>
          <View style={styles.trackContainer}>
            {currentTrack.image_url && (
              <Image source={{ uri: currentTrack.image_url }} style={styles.albumCover} />
            )}
            <View style={styles.trackInfo}>
              <ThemedText type="defaultSemiBold">{currentTrack.name}</ThemedText>
              <ThemedText>{currentTrack.artist}</ThemedText>
              <ThemedText style={styles.albumText}>{currentTrack.album}</ThemedText>
            </View>
          </View>
        </ThemedView>
      )}
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  trackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  albumCover: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  trackInfo: {
    flex: 1,
  },
  albumText: {
    opacity: 0.7,
    fontSize: 12,
  },
});
