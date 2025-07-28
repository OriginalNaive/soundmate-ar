import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  Text, 
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions
} from 'react-native';
import MapView, { 
  PROVIDER_GOOGLE, 
  Polygon, 
  Region, 
  MapPressEvent,
  Marker
} from 'react-native-maps';
import * as Location from 'expo-location';
import { h3ToGeoBoundary, latLngToCell } from 'h3-js';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

const { width, height } = Dimensions.get('window');

interface HexagonData {
  hex_id: string;
  center_lat: number;
  center_lng: number;
  color_hex: string;
  total_plays: number;
  unique_users: number;
  unique_tracks: number;
  avg_energy?: number;
  avg_valence?: number;
  avg_danceability?: number;
  top_tracks?: Array<{
    track_name: string;
    artist_name: string;
    play_count: number;
  }>;
}

interface UserLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface EnhancedMusicMapProps {
  onHexPress?: (hexData: HexagonData) => void;
  showUserLocation?: boolean;
  enableHeatmap?: boolean;
  filterByTimeRange?: 'day' | 'week' | 'month' | 'all';
}

export default function EnhancedMusicMap({ 
  onHexPress,
  showUserLocation = true,
  enableHeatmap = true,
  filterByTimeRange = 'week'
}: EnhancedMusicMapProps) {
  const [region, setRegion] = useState<Region | null>(null);
  const [hexagons, setHexagons] = useState<HexagonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHex, setSelectedHex] = useState<HexagonData | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [showHexDetails, setShowHexDetails] = useState(false);
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite' | 'hybrid'>('standard');
  
  const mapRef = useRef<MapView>(null);
  const performanceMonitor = usePerformanceMonitor();

  // 初始化用戶位置
  useEffect(() => {
    initializeLocation();
  }, []);

  // 當地圖區域改變時載入附近的六邊形
  useEffect(() => {
    if (region) {
      performanceMonitor.startRender();
      loadNearbyHexagons();
    }
  }, [region, filterByTimeRange]);

  // 定期更新用戶位置
  useEffect(() => {
    if (showUserLocation) {
      const locationInterval = setInterval(updateUserLocation, 30000); // 每30秒更新一次
      return () => clearInterval(locationInterval);
    }
  }, [showUserLocation]);

  const initializeLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('權限不足', '需要位置權限才能顯示音樂地圖');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const initialRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01, // 更精確的初始縮放
        longitudeDelta: 0.01,
      };

      setRegion(initialRegion);
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: Date.now()
      });
      setLoading(false);
    } catch (error) {
      console.error('獲取位置失敗:', error);
      Alert.alert('錯誤', '無法獲取當前位置');
      setLoading(false);
    }
  };

  const updateUserLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('更新位置失敗:', error);
    }
  };

  const loadNearbyHexagons = async () => {
    if (!region) return;

    try {
      // 計算搜索邊界
      const bounds = {
        northEast: {
          latitude: region.latitude + region.latitudeDelta / 2,
          longitude: region.longitude + region.longitudeDelta / 2,
        },
        southWest: {
          latitude: region.latitude - region.latitudeDelta / 2,
          longitude: region.longitude - region.longitudeDelta / 2,
        }
      };

      const response = await fetch(
        `http://localhost:5000/api/map/data?` +
        `lat=${region.latitude}&lng=${region.longitude}&` +
        `zoom=${calculateZoomLevel(region)}&` +
        `timeRange=${filterByTimeRange}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setHexagons(data.hexagons || []);
        performanceMonitor.endRender(data.hexagons?.length || 0);
      } else {
        console.error('載入六邊形失敗:', response.statusText);
      }
    } catch (error) {
      console.error('載入六邊形錯誤:', error);
    }
  };

  const calculateZoomLevel = (region: Region): number => {
    const angle = region.longitudeDelta;
    return Math.round(Math.log(360 / angle) / Math.LN2);
  };

  const handleMapPress = (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    
    // 計算點擊位置對應的 hex
    const hexId = latLngToCell(latitude, longitude, 9);
    
    // 找到對應的六邊形數據
    const hexData = hexagons.find(hex => hex.hex_id === hexId);
    if (hexData) {
      setSelectedHex(hexData);
      setShowHexDetails(true);
      onHexPress?.(hexData);
    }
  };

  const handleHexPress = useCallback((hexData: HexagonData) => {
    setSelectedHex(hexData);
    setShowHexDetails(true);
    onHexPress?.(hexData);
  }, [onHexPress]);

  const renderHexagons = () => {
    return hexagons.map((hex) => {
      const boundary = h3ToGeoBoundary(hex.hex_id, true);
      const coordinates = boundary.map(([lat, lng]) => ({
        latitude: lat,
        longitude: lng,
      }));

      const opacity = enableHeatmap 
        ? Math.min(0.3 + (hex.total_plays / 100) * 0.5, 0.8)
        : 0.6;

      return (
        <Polygon
          key={hex.hex_id}
          coordinates={coordinates}
          fillColor={`${hex.color_hex}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`}
          strokeColor={hex.color_hex}
          strokeWidth={1}
          onPress={() => handleHexPress(hex)}
        />
      );
    });
  };

  const renderUserLocation = () => {
    if (!showUserLocation || !userLocation) return null;

    return (
      <Marker
        coordinate={{
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        }}
        title="您的位置"
        description={`更新時間: ${new Date(userLocation.timestamp).toLocaleTimeString()}`}
        pinColor="blue"
      />
    );
  };

  const renderMapControls = () => (
    <View style={styles.mapControls}>
      <TouchableOpacity
        style={styles.controlButton}
        onPress={() => setMapStyle(mapStyle === 'standard' ? 'satellite' : 'standard')}
      >
        <ThemedText style={styles.controlButtonText}>
          {mapStyle === 'standard' ? '衛星' : '標準'}
        </ThemedText>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.controlButton}
        onPress={() => mapRef.current?.animateToRegion(region!, 1000)}
      >
        <ThemedText style={styles.controlButtonText}>重置</ThemedText>
      </TouchableOpacity>
    </View>
  );

  const renderHexDetailsModal = () => (
    <Modal
      visible={showHexDetails}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowHexDetails(false)}
    >
      <View style={styles.modalOverlay}>
        <ThemedView style={styles.modalContent}>
          <ScrollView>
            <ThemedText style={styles.modalTitle}>音樂熱點詳情</ThemedText>
            
            {selectedHex && (
              <>
                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <ThemedText style={styles.statLabel}>總播放次數</ThemedText>
                    <ThemedText style={styles.statValue}>{selectedHex.total_plays}</ThemedText>
                  </View>
                  <View style={styles.statItem}>
                    <ThemedText style={styles.statLabel}>用戶數</ThemedText>
                    <ThemedText style={styles.statValue}>{selectedHex.unique_users}</ThemedText>
                  </View>
                  <View style={styles.statItem}>
                    <ThemedText style={styles.statLabel}>歌曲數</ThemedText>
                    <ThemedText style={styles.statValue}>{selectedHex.unique_tracks}</ThemedText>
                  </View>
                </View>

                {selectedHex.avg_energy !== undefined && (
                  <View style={styles.featuresContainer}>
                    <ThemedText style={styles.sectionTitle}>音樂特徵</ThemedText>
                    <View style={styles.featureBar}>
                      <ThemedText>能量值: {(selectedHex.avg_energy * 100).toFixed(0)}%</ThemedText>
                      <View style={styles.progressBar}>
                        <View style={[styles.progress, { width: `${selectedHex.avg_energy * 100}%` }]} />
                      </View>
                    </View>
                    <View style={styles.featureBar}>
                      <ThemedText>愉悅度: {(selectedHex.avg_valence! * 100).toFixed(0)}%</ThemedText>
                      <View style={styles.progressBar}>
                        <View style={[styles.progress, { width: `${selectedHex.avg_valence! * 100}%` }]} />
                      </View>
                    </View>
                    <View style={styles.featureBar}>
                      <ThemedText>舞曲性: {(selectedHex.avg_danceability! * 100).toFixed(0)}%</ThemedText>
                      <View style={styles.progressBar}>
                        <View style={[styles.progress, { width: `${selectedHex.avg_danceability! * 100}%` }]} />
                      </View>
                    </View>
                  </View>
                )}

                {selectedHex.top_tracks && selectedHex.top_tracks.length > 0 && (
                  <View style={styles.tracksContainer}>
                    <ThemedText style={styles.sectionTitle}>熱門歌曲</ThemedText>
                    {selectedHex.top_tracks.slice(0, 5).map((track, index) => (
                      <View key={index} style={styles.trackItem}>
                        <ThemedText style={styles.trackName}>{track.track_name}</ThemedText>
                        <ThemedText style={styles.artistName}>{track.artist_name}</ThemedText>
                        <ThemedText style={styles.playCount}>{track.play_count} 次播放</ThemedText>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
          
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowHexDetails(false)}
          >
            <ThemedText style={styles.closeButtonText}>關閉</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
        <ThemedText style={styles.loadingText}>載入音樂地圖中...</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={region!}
        onRegionChangeComplete={setRegion}
        onPress={handleMapPress}
        mapType={mapStyle}
        showsUserLocation={false} // 使用自定義用戶位置標記
        showsMyLocationButton={false}
      >
        {renderHexagons()}
        {renderUserLocation()}
      </MapView>
      
      {renderMapControls()}
      {renderHexDetailsModal()}
      
      <View style={styles.legend}>
        <ThemedText style={styles.legendText}>
          🎵 {hexagons.length} 個音樂熱點
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  mapControls: {
    position: 'absolute',
    top: 50,
    right: 15,
    flexDirection: 'column',
  },
  controlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  controlButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  legend: {
    position: 'absolute',
    bottom: 20,
    left: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
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
    paddingBottom: 30,
    maxHeight: height * 0.8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureBar: {
    marginBottom: 10,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginTop: 4,
  },
  progress: {
    height: '100%',
    backgroundColor: '#1DB954',
    borderRadius: 2,
  },
  tracksContainer: {
    marginBottom: 20,
  },
  trackItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  trackName: {
    fontSize: 14,
    fontWeight: '600',
  },
  artistName: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  playCount: {
    fontSize: 10,
    opacity: 0.5,
    marginTop: 2,
  },
  closeButton: {
    backgroundColor: '#1DB954',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});