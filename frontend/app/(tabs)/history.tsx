import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import axios from 'axios';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { getStoredAccessToken } from '@/services/spotifyAuth';

const API_BASE_URL = 'http://192.168.1.106:5000/api';

interface PlaybackRecord {
  id: string;
  track_name: string;
  artist_name: string;
  album_name: string;
  image_url?: string;
  played_at: string;
  location?: {
    lat: number;
    lng: number;
  };
  hex_id?: string;
}

export default function MusicHistoryScreen() {
  const [records, setRecords] = useState<PlaybackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPlaybackHistory();
  }, []);

  const loadPlaybackHistory = async () => {
    try {
      // 暫時使用模擬數據，直到數據庫設置完成
      console.log('載入播放記錄...');
      
      // 模擬載入時間
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setRecords([
        {
          id: '1',
          track_name: 'As It Was',
          artist_name: 'Harry Styles',
          album_name: "Harry's House",
          image_url: 'https://i.scdn.co/image/ab67616d0000b273b46f74097655d7f353caab14',
          played_at: new Date().toISOString(),
          location: { lat: 25.0330, lng: 121.5654 }
        },
        {
          id: '2',
          track_name: 'Anti-Hero',
          artist_name: 'Taylor Swift',
          album_name: 'Midnights',
          image_url: 'https://i.scdn.co/image/ab67616d0000b273bb54dde68cd23e2a268ae0f5',
          played_at: new Date(Date.now() - 3600000).toISOString(),
          location: { lat: 25.0340, lng: 121.5660 }
        },
        {
          id: '3',
          track_name: 'Flowers',
          artist_name: 'Miley Cyrus',
          album_name: 'Endless Summer Vacation',
          image_url: 'https://i.scdn.co/image/ab67616d0000b273f4fdcd41b9b058ec4a851c6e',
          played_at: new Date(Date.now() - 7200000).toISOString(),
          location: { lat: 25.0350, lng: 121.5670 }
        }
      ]);
    } catch (error) {
      console.error('獲取播放記錄失敗:', error);
      setRecords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPlaybackHistory();
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
      <ThemedView style={styles.container}>
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1DB954" />
          <ThemedText style={styles.loadingText}>載入播放記錄...</ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">播放記錄</ThemedText>
        <ThemedText style={styles.subtitle}>
          共 {records.length} 首歌曲
        </ThemedText>
      </ThemedView>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {records.length === 0 ? (
          <ThemedView style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>尚無播放記錄</ThemedText>
            <ThemedText style={styles.emptySubtext}>
              開始播放音樂後，記錄將會顯示在這裡
            </ThemedText>
          </ThemedView>
        ) : (
          records.map((record) => (
            <TouchableOpacity key={record.id} style={styles.recordCard}>
              <ThemedView style={styles.recordContent}>
                {record.image_url && (
                  <Image 
                    source={{ uri: record.image_url }} 
                    style={styles.albumCover}
                  />
                )}
                <ThemedView style={styles.trackInfo}>
                  <ThemedText type="defaultSemiBold" style={styles.trackName}>
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
                    {record.location && (
                      <ThemedText style={styles.location}>
                        📍 {record.location.lat.toFixed(4)}, {record.location.lng.toFixed(4)}
                      </ThemedText>
                    )}
                  </ThemedView>
                </ThemedView>
              </ThemedView>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  subtitle: {
    opacity: 0.7,
    marginTop: 5,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    opacity: 0.7,
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
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  albumCover: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    fontSize: 16,
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
    flexDirection: 'column',
    gap: 2,
  },
  playedAt: {
    fontSize: 11,
    opacity: 0.6,
  },
  location: {
    fontSize: 11,
    opacity: 0.6,
  },
});