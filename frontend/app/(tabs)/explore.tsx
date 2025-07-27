import React, { useState } from 'react';
import { View, StyleSheet, Modal, Text, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// import MusicMap from '@/components/MusicMap'; // React Native Maps 需要原生配置
import ExpoGoMap from '@/components/ExpoGoMap'; // Expo Go 兼容版本
import NetworkTest from '@/components/NetworkTest';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { API_BASE_URL, fetchWithRetry, handleNetworkError } from '@/config/api';

interface HexagonData {
  hex_id: string;
  center_lat: number;
  center_lng: number;
  color_hex: string;
  total_plays: number;
  unique_users: number;
  unique_tracks: number;
}

interface TopTrack {
  id: string;
  name: string;
  artist: string;
  album?: string;
  image_url?: string;
}

export default function ExploreScreen() {
  const [selectedHex, setSelectedHex] = useState<HexagonData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [topTracks, setTopTracks] = useState<TopTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNetworkTest, setShowNetworkTest] = useState(false);

  const handleHexPress = async (hexData: HexagonData) => {
    console.log('探索頁面 - 六邊形被點擊:', hexData);
    setSelectedHex(hexData);
    setLoading(true);
    setModalVisible(true);

    try {
      // 載入該六邊形的熱門歌曲
      await loadHexTopTracks(hexData.hex_id);
    } catch (error) {
      console.error('載入熱門歌曲失敗:', error);
      // 使用模擬資料 (基於六邊形ID生成一致的資料)
      setTopTracks(generateMockTopTracks(hexData.hex_id));
    } finally {
      setLoading(false);
    }
  };

  const loadHexTopTracks = async (hexId: string) => {
    try {
      console.log(`🎵 載入六邊形 ${hexId} 的歌曲，連接到: ${API_BASE_URL}`);
      
      const response = await fetchWithRetry(`${API_BASE_URL}/map/hex/${hexId}/tracks?limit=10`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.tracks.length > 0) {
          console.log(`✅ 載入 ${data.data.tracks.length} 首真實歌曲 for hex ${hexId}`);
          setTopTracks(data.data.tracks);
          return;
        }
      }
      
      throw new Error(`API 回應異常: ${response.status}`);
    } catch (error: any) {
      console.error('❌ 載入六邊形歌曲失敗:', error);
      const errorInfo = handleNetworkError(error);
      console.log('🔄 使用模擬資料作為備選');
      throw error;
    }
  };

  const generateMockTopTracks = (hexId: string): TopTrack[] => {
    // 基於 hexId 生成一致的模擬資料
    const trackPools = [
      [
        { id: '1', name: 'Shape of You', artist: 'Ed Sheeran', album: '÷ (Divide)' },
        { id: '2', name: 'Perfect', artist: 'Ed Sheeran', album: '÷ (Divide)' },
        { id: '3', name: 'Castle on the Hill', artist: 'Ed Sheeran', album: '÷ (Divide)' },
      ],
      [
        { id: '4', name: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours' },
        { id: '5', name: 'Save Your Tears', artist: 'The Weeknd', album: 'After Hours' },
        { id: '6', name: 'Can\'t Feel My Face', artist: 'The Weeknd', album: 'Beauty Behind the Madness' },
      ],
      [
        { id: '7', name: 'Watermelon Sugar', artist: 'Harry Styles', album: 'Fine Line' },
        { id: '8', name: 'Golden', artist: 'Harry Styles', album: 'Fine Line' },
        { id: '9', name: 'Adore You', artist: 'Harry Styles', album: 'Fine Line' },
      ],
      [
        { id: '10', name: 'Levitating', artist: 'Dua Lipa', album: 'Future Nostalgia' },
        { id: '11', name: 'Don\'t Start Now', artist: 'Dua Lipa', album: 'Future Nostalgia' },
        { id: '12', name: 'Physical', artist: 'Dua Lipa', album: 'Future Nostalgia' },
      ],
      [
        { id: '13', name: 'Good 4 U', artist: 'Olivia Rodrigo', album: 'SOUR' },
        { id: '14', name: 'drivers license', artist: 'Olivia Rodrigo', album: 'SOUR' },
        { id: '15', name: 'deja vu', artist: 'Olivia Rodrigo', album: 'SOUR' },
      ],
    ];
    
    // 使用 hexId 的 hash 選擇歌曲組合
    const hash = hexId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const poolIndex = Math.abs(hash) % trackPools.length;
    const selectedPool = trackPools[poolIndex];
    
    // 隨機選擇 2-4 首歌曲
    const numTracks = 2 + Math.abs(hash % 3);
    const shuffled = [...selectedPool].sort(() => 0.5 - Math.random());
    
    return shuffled.slice(0, numTracks);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedHex(null);
    setTopTracks([]);
  };

  const renderTrackItem = ({ item }: { item: TopTrack }) => (
    <TouchableOpacity style={styles.trackItem}>
      <View style={styles.trackInfo}>
        <ThemedText type="defaultSemiBold" style={styles.trackName}>
          {item.name}
        </ThemedText>
        <ThemedText style={styles.trackArtist}>
          {item.artist}
        </ThemedText>
        {item.album && (
          <ThemedText style={styles.trackAlbum}>
            {item.album}
          </ThemedText>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">音樂地圖探索</ThemedText>
        <ThemedText type="subtitle">發現你周圍的音樂世界</ThemedText>
        <TouchableOpacity 
          style={styles.networkTestButton}
          onPress={() => setShowNetworkTest(!showNetworkTest)}
        >
          <ThemedText style={styles.networkTestButtonText}>
            {showNetworkTest ? '隱藏' : '顯示'} 網路測試
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>

      {showNetworkTest && <NetworkTest />}

      <ExpoGoMap onHexPress={handleHexPress} />

      {/* 六邊形資訊 Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">音樂熱點資訊</ThemedText>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <ThemedText style={styles.closeButtonText}>✕</ThemedText>
              </TouchableOpacity>
            </View>

            {selectedHex && (
              <View style={styles.hexInfo}>
                <View style={styles.hexHeader}>
                  <ThemedText type="defaultSemiBold" style={styles.hexTitle}>
                    音樂熱點 #{selectedHex.hex_id.slice(-8)}
                  </ThemedText>
                  <View 
                    style={[
                      styles.colorIndicator, 
                      { backgroundColor: selectedHex.color_hex }
                    ]} 
                  />
                </View>
                
                <View style={styles.hexStats}>
                  <View style={styles.statItem}>
                    <ThemedText type="defaultSemiBold" style={styles.statNumber}>
                      {selectedHex.total_plays}
                    </ThemedText>
                    <ThemedText style={styles.statLabel}>播放次數</ThemedText>
                  </View>
                  <View style={styles.statItem}>
                    <ThemedText type="defaultSemiBold" style={styles.statNumber}>
                      {selectedHex.unique_users}
                    </ThemedText>
                    <ThemedText style={styles.statLabel}>用戶數</ThemedText>
                  </View>
                  <View style={styles.statItem}>
                    <ThemedText type="defaultSemiBold" style={styles.statNumber}>
                      {selectedHex.unique_tracks}
                    </ThemedText>
                    <ThemedText style={styles.statLabel}>歌曲數</ThemedText>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.tracksSection}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                熱門歌曲
              </ThemedText>
              
              {loading ? (
                <ThemedText style={styles.loadingText}>載入中...</ThemedText>
              ) : (
                <FlatList
                  data={topTracks}
                  renderItem={renderTrackItem}
                  keyExtractor={(item) => item.id}
                  style={styles.tracksList}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  networkTestButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  networkTestButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  hexInfo: {
    marginBottom: 20,
  },
  hexHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  hexTitle: {
    fontSize: 16,
    flex: 1,
  },
  hexStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 18,
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  colorIndicator: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  tracksSection: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 16,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 20,
    opacity: 0.7,
  },
  tracksList: {
    flex: 1,
  },
  trackItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    fontSize: 14,
    marginBottom: 2,
  },
  trackArtist: {
    fontSize: 13,
    opacity: 0.8,
    marginBottom: 2,
  },
  trackAlbum: {
    fontSize: 12,
    opacity: 0.6,
  },
});
