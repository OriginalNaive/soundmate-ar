import React, { useState, useEffect } from 'react';
import { 
  ScrollView, 
  StyleSheet, 
  ActivityIndicator, 
  TouchableOpacity, 
  RefreshControl,
  View 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

interface PlaybackRecord {
  id: number;
  track_id: string;
  track_name: string;
  artist_name: string;
  album_name: string;
  duration_ms: number;
  played_at: string;
  hex_id: string;
  latitude: number;
  longitude: number;
}

export default function HistoryScreen() {
  const [playbackHistory, setPlaybackHistory] = useState<PlaybackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPlaybackHistory();
  }, []);

  const loadPlaybackHistory = async () => {
    try {
      console.log('載入播放記錄...');
      
      // 獲取 Spotify access token
      const { getStoredAccessToken } = await import('@/services/spotifyAuth');
      const accessToken = await getStoredAccessToken();
      
      if (!accessToken) {
        console.log('沒有 access token，顯示空記錄');
        setPlaybackHistory([]);
        return;
      }

      // 調用後端 API 獲取真實播放記錄
      const { API_BASE_URL, fetchWithRetry } = await import('@/config/api');
      const apiUrl = `${API_BASE_URL}/music/history?limit=20`;
      console.log('正在調用歷史記錄 API:', apiUrl);
      
      const response = await fetchWithRetry(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('API 回應狀態:', response.status);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.tracks) {
          console.log(`✅ 載入 ${data.data.tracks.length} 筆真實播放記錄`);
          
          // 轉換資料格式以符合前端需求
          const formattedHistory = data.data.tracks.map((record: any) => ({
            id: record.id,
            track_id: record.track_id,
            track_name: record.track_name,
            artist_name: record.artist_name,
            album_name: record.album_name || 'Unknown Album',
            duration_ms: record.duration_ms || 0,
            played_at: record.played_at,
            hex_id: record.hex_id,
            latitude: record.latitude,
            longitude: record.longitude
          }));
          
          setPlaybackHistory(formattedHistory);
          return;
        }
      }
      
      // 如果 API 調用失敗，顯示空記錄
      throw new Error(`API 調用失敗: ${response.status}`);
    } catch (error: any) {
      console.error('獲取播放記錄失敗:', error);
      console.error('錯誤詳情:', error.message);
      
      // 如果是網路錯誤或 token 過期，顯示適當訊息
      if (error.message?.includes('401')) {
        console.log('Token 可能已過期，需要重新登入');
      }
      
      setPlaybackHistory([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPlaybackHistory();
  };

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatPlayedAt = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return '剛剛';
    } else if (diffInHours < 24) {
      return `${diffInHours} 小時前`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} 天前`;
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
        <ThemedText style={styles.loadingText}>載入播放記錄中...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Ionicons
          size={310}
          name="library-outline"
          style={styles.headerImage}
        />
      }
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">播放歷史</ThemedText>
        <ThemedText style={styles.subtitle}>
          探索您的音樂足跡與偏好
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="musical-notes" size={24} color="#1DB954" />
          <ThemedText style={styles.statNumber}>{playbackHistory.length}</ThemedText>
          <ThemedText style={styles.statLabel}>總播放次數</ThemedText>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="library" size={24} color="#1DB954" />
          <ThemedText style={styles.statNumber}>
            {new Set(playbackHistory.map(r => r.track_id)).size}
          </ThemedText>
          <ThemedText style={styles.statLabel}>不同歌曲</ThemedText>
        </View>
      </ThemedView>

      <ThemedView style={styles.historyContainer}>
        <ThemedText style={styles.sectionTitle}>最近播放</ThemedText>
        
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#1DB954']}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {playbackHistory.length === 0 ? (
            <ThemedView style={styles.emptyContainer}>
              <ThemedText style={styles.emptyText}>尚無播放記錄</ThemedText>
              <ThemedText style={styles.emptySubtext}>
                開始播放音樂後，記錄將會顯示在這裡
              </ThemedText>
            </ThemedView>
          ) : (
            playbackHistory.map((record) => (
              <TouchableOpacity key={record.id} style={styles.recordCard}>
                <ThemedView style={styles.recordContent}>
                  <ThemedView style={styles.trackInfo}>
                    <ThemedText style={styles.trackName}>
                      {record.track_name}
                    </ThemedText>
                    <ThemedText style={styles.artistName}>
                      {record.artist_name}
                    </ThemedText>
                    <ThemedText style={styles.albumName}>
                      {record.album_name}
                    </ThemedText>
                    <ThemedView style={styles.metaInfo}>
                      <ThemedText style={styles.playedAt}>
                        🕐 {formatPlayedAt(record.played_at)}
                      </ThemedText>
                      <ThemedText style={styles.duration}>
                        ⏱️ {formatDuration(record.duration_ms)}
                      </ThemedText>
                      <ThemedText style={styles.location}>
                        📍 {record.hex_id.substring(0, 8)}...
                      </ThemedText>
                    </ThemedView>
                  </ThemedView>
                </ThemedView>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    opacity: 0.7,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minWidth: 100,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  historyContainer: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  emptySubtext: {
    opacity: 0.7,
    textAlign: 'center',
  },
  recordCard: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  recordContent: {
    padding: 16,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  artistName: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 2,
  },
  albumName: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 8,
  },
  metaInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  playedAt: {
    fontSize: 11,
    opacity: 0.6,
  },
  duration: {
    fontSize: 11,
    opacity: 0.6,
  },
  location: {
    fontSize: 11,
    opacity: 0.6,
  },
});