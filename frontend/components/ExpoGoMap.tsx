import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import { h3ToGeoBoundary } from 'h3-js';
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

interface ExpoGoMapProps {
  onHexPress?: (hexData: HexagonData) => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function ExpoGoMap({ onHexPress }: ExpoGoMapProps) {
  const [region, setRegion] = useState({
    latitude: 25.0330,
    longitude: 121.5654,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [hexagons, setHexagons] = useState<HexagonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeLocation();
  }, []);

  useEffect(() => {
    if (region) {
      loadNearbyHexagons();
    }
  }, [region]);

  const initializeLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('需要位置權限才能顯示地圖');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      setLoading(false);
    } catch (error) {
      console.error('獲取位置失敗:', error);
      setLoading(false);
    }
  };

  const loadNearbyHexagons = async () => {
    try {
      const north = region.latitude + region.latitudeDelta / 2;
      const south = region.latitude - region.latitudeDelta / 2;
      const east = region.longitude + region.longitudeDelta / 2;
      const west = region.longitude - region.longitudeDelta / 2;

      console.log(`🌐 嘗試連接到: ${API_BASE_URL}/map/hexagons`);
      
      const response = await fetchWithRetry(
        `${API_BASE_URL}/map/hexagons?north=${north}&south=${south}&east=${east}&west=${west}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.hexagons.length > 0) {
          console.log(`✅ 載入 ${data.data.hexagons.length} 個真實六邊形`);
          setHexagons(data.data.hexagons);
          setError(null);
          return;
        }
      }
      
      throw new Error(`API 回應異常: ${response.status}`);
    } catch (error: any) {
      console.error('❌ 載入六邊形資料失敗:', error);
      const errorInfo = handleNetworkError(error);
      setError(`${errorInfo.error.message} - 使用模擬資料`);
      setHexagons(generateMockHexagons());
    }
  };

  const generateMockHexagons = (): HexagonData[] => {
    const mockData: HexagonData[] = [];
    const numHexes = 12;

    for (let i = 0; i < numHexes; i++) {
      const lat = region.latitude + (Math.random() - 0.5) * region.latitudeDelta * 0.8;
      const lng = region.longitude + (Math.random() - 0.5) * region.longitudeDelta * 0.8;
      
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#FFD93D'];
      const color = colors[i % colors.length];
      
      mockData.push({
        hex_id: `mock_hex_${i}`,
        center_lat: lat,
        center_lng: lng,
        color_hex: color,
        total_plays: Math.floor(Math.random() * 100) + 10,
        unique_users: Math.floor(Math.random() * 20) + 5,
        unique_tracks: Math.floor(Math.random() * 30) + 10,
      });
    }

    return mockData;
  };

  const latToY = (lat: number) => {
    const normalizedLat = (lat - (region.latitude - region.latitudeDelta / 2)) / region.latitudeDelta;
    return (1 - normalizedLat) * (screenHeight * 0.6);
  };

  const lngToX = (lng: number) => {
    const normalizedLng = (lng - (region.longitude - region.longitudeDelta / 2)) / region.longitudeDelta;
    return normalizedLng * (screenWidth * 0.9);
  };

  const renderHexagon = (hex: HexagonData, index: number) => {
    const x = lngToX(hex.center_lng);
    const y = latToY(hex.center_lat);

    if (x < 0 || x > screenWidth * 0.9 || y < 0 || y > screenHeight * 0.6) {
      return null;
    }

    return (
      <TouchableOpacity
        key={hex.hex_id}
        style={[
          styles.hexagon,
          {
            left: x - 20,
            top: y - 20,
            backgroundColor: hex.color_hex,
          },
        ]}
        onPress={() => onHexPress?.(hex)}
        activeOpacity={0.7}
      >
        <Text style={styles.hexagonText}>{hex.total_plays}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>載入地圖中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapHeader}>
        <Text style={styles.headerText}>音樂熱點地圖 (Expo Go 模式)</Text>
        <Text style={styles.locationText}>
          📍 {region.latitude.toFixed(4)}, {region.longitude.toFixed(4)}
        </Text>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <View style={styles.mapContainer}>
        <View style={styles.mapBackground}>
          {hexagons.map((hex, index) => renderHexagon(hex, index))}
        </View>
      </View>

      <View style={styles.mapFooter}>
        <TouchableOpacity style={styles.refreshButton} onPress={loadNearbyHexagons}>
          <Text style={styles.refreshButtonText}>🔄 重新載入</Text>
        </TouchableOpacity>
        <Text style={styles.statsText}>
          顯示 {hexagons.length} 個音樂熱點
        </Text>
      </View>

      <ScrollView style={styles.legend} horizontal showsHorizontalScrollIndicator={false}>
        <Text style={styles.legendTitle}>🎵 音樂類型: </Text>
        <View style={[styles.legendItem, { backgroundColor: '#FF6B6B' }]}>
          <Text style={styles.legendText}>流行</Text>
        </View>
        <View style={[styles.legendItem, { backgroundColor: '#4ECDC4' }]}>
          <Text style={styles.legendText}>電子</Text>
        </View>
        <View style={[styles.legendItem, { backgroundColor: '#45B7D1' }]}>
          <Text style={styles.legendText}>搖滾</Text>
        </View>
        <View style={[styles.legendItem, { backgroundColor: '#FFA07A' }]}>
          <Text style={styles.legendText}>爵士</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  mapHeader: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    color: '#FF6B6B',
    textAlign: 'center',
    marginTop: 4,
  },
  mapContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mapBackground: {
    flex: 1,
    backgroundColor: '#E8F5E8',
    position: 'relative',
  },
  hexagon: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  hexagonText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  mapFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statsText: {
    fontSize: 14,
    color: '#666',
  },
  legend: {
    backgroundColor: 'white',
    maxHeight: 50,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    paddingVertical: 16,
    paddingLeft: 16,
  },
  legendItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 8,
    marginRight: 8,
    borderRadius: 16,
  },
  legendText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#666',
  },
});