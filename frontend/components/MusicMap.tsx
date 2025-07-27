import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Polygon, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { h3ToGeoBoundary, latLngToCell } from 'h3-js';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';

interface HexagonData {
  hex_id: string;
  center_lat: number;
  center_lng: number;
  color_hex: string;
  total_plays: number;
  unique_users: number;
  unique_tracks: number;
}

interface MusicMapProps {
  onHexPress?: (hexData: HexagonData) => void;
}

export default function MusicMap({ onHexPress }: MusicMapProps) {
  const [region, setRegion] = useState<Region | null>(null);
  const [hexagons, setHexagons] = useState<HexagonData[]>([]);
  const [loading, setLoading] = useState(true);
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
  }, [region]);

  // 監控六邊形渲染效能
  useEffect(() => {
    if (hexagons.length > 0) {
      const visibleCount = getVisibleHexagons().length;
      performanceMonitor.endRender(visibleCount);
      
      // 每 20 次渲染記錄一次統計
      if (Math.random() < 0.05) {
        performanceMonitor.logMetrics();
      }
    }
  }, [hexagons]);

  const initializeLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('權限被拒絕', '需要位置權限才能顯示地圖');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const initialRegion: Region = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01, // 較小的區域以便看到六邊形
        longitudeDelta: 0.01,
      };

      setRegion(initialRegion);
      setLoading(false);
    } catch (error) {
      console.error('獲取位置失敗:', error);
      // 使用預設位置 (台北)
      const defaultRegion: Region = {
        latitude: 25.0330,
        longitude: 121.5654,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(defaultRegion);
      setLoading(false);
    }
  };

  const loadNearbyHexagons = async () => {
    if (!region) return;

    try {
      // 計算地圖邊界
      const north = region.latitude + region.latitudeDelta / 2;
      const south = region.latitude - region.latitudeDelta / 2;
      const east = region.longitude + region.longitudeDelta / 2;
      const west = region.longitude - region.longitudeDelta / 2;

      // 呼叫後端 API 獲取該區域的六邊形資料
      const API_BASE_URL = 'http://localhost:5000/api';
      const response = await fetch(
        `${API_BASE_URL}/map/hexagons?north=${north}&south=${south}&east=${east}&west=${west}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.hexagons.length > 0) {
          console.log(`載入 ${data.data.hexagons.length} 個真實六邊形`);
          setHexagons(data.data.hexagons);
          return;
        }
      }
      
      // 如果 API 失敗或沒有資料，使用模擬資料
      console.log('使用模擬六邊形資料');
      setHexagons(generateMockHexagons(region));
    } catch (error) {
      console.error('載入六邊形資料失敗:', error);
      // 使用模擬資料
      setHexagons(generateMockHexagons(region));
    }
  };

  // 生成模擬六邊形資料 (開發用)
  const generateMockHexagons = (mapRegion: Region): HexagonData[] => {
    const mockData: HexagonData[] = [];
    const numHexes = 15; // 生成 15 個測試六邊形 (減少數量避免效能問題)
    const resolution = 9; // H3 解析度級別

    for (let i = 0; i < numHexes; i++) {
      // 在當前區域隨機生成位置
      const lat = mapRegion.latitude + (Math.random() - 0.5) * mapRegion.latitudeDelta * 0.8;
      const lng = mapRegion.longitude + (Math.random() - 0.5) * mapRegion.longitudeDelta * 0.8;
      
      try {
        // 生成真實的 H3 hex_id
        const h3Index = latLngToCell(lat, lng, resolution);
        
        // 生成隨機顏色 (模擬音樂情緒)
        const hue = Math.floor(Math.random() * 360);
        const saturation = 50 + Math.floor(Math.random() * 50); // 50-100%
        const lightness = 40 + Math.floor(Math.random() * 30); // 40-70%
        
        mockData.push({
          hex_id: h3Index,
          center_lat: lat,
          center_lng: lng,
          color_hex: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
          total_plays: Math.floor(Math.random() * 100),
          unique_users: Math.floor(Math.random() * 20),
          unique_tracks: Math.floor(Math.random() * 50),
        });
      } catch (error) {
        console.error(`生成 H3 索引失敗 (${lat}, ${lng}):`, error);
        // 回退到模擬 ID
        const hue = Math.floor(Math.random() * 360);
        const saturation = 50 + Math.floor(Math.random() * 50);
        const lightness = 40 + Math.floor(Math.random() * 30);
        
        mockData.push({
          hex_id: `mock_hex_${i}`,
          center_lat: lat,
          center_lng: lng,
          color_hex: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
          total_plays: Math.floor(Math.random() * 100),
          unique_users: Math.floor(Math.random() * 20),
          unique_tracks: Math.floor(Math.random() * 50),
        });
      }
    }

    return mockData;
  };

  // 將六邊形資料轉換為 Polygon 座標
  const getHexagonCoordinates = (hexData: HexagonData) => {
    try {
      // 使用真正的 H3 六邊形邊界計算
      if (hexData.hex_id.startsWith('mock_')) {
        // 對於舊的模擬資料，生成實際的 H3 hex_id
        const { center_lat, center_lng } = hexData;
        const resolution = 9; // H3 解析度級別 (約 100-500 公尺六邊形)
        const h3Index = latLngToCell(center_lat, center_lng, resolution);
        const boundary = h3ToGeoBoundary(h3Index);
        return boundary.map(([lat, lng]) => ({
          latitude: lat,
          longitude: lng,
        }));
      } else {
        // 對於真實的 H3 hex_id，直接使用
        const boundary = h3ToGeoBoundary(hexData.hex_id);
        return boundary.map(([lat, lng]) => ({
          latitude: lat,
          longitude: lng,
        }));
      }
    } catch (error) {
      console.error('計算六邊形座標失敗:', error, 'hex_id:', hexData.hex_id);
      // 回退到簡單的圓形模擬
      const { center_lat, center_lng } = hexData;
      const radius = 0.001;
      const points = [];
      
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const lat = center_lat + radius * Math.cos(angle);
        const lng = center_lng + radius * Math.sin(angle);
        points.push({ latitude: lat, longitude: lng });
      }
      
      return points;
    }
  };

  const handleRegionChange = (newRegion: Region) => {
    setRegion(newRegion);
  };

  // 過濾可見範圍內的六邊形以提升效能
  const getVisibleHexagons = () => {
    if (!region) return hexagons;
    
    const visibleHexagons = hexagons.filter(hexData => {
      const { center_lat, center_lng } = hexData;
      const margin = 0.001; // 增加一點邊界容差
      
      return (
        center_lat >= region.latitude - region.latitudeDelta / 2 - margin &&
        center_lat <= region.latitude + region.latitudeDelta / 2 + margin &&
        center_lng >= region.longitude - region.longitudeDelta / 2 - margin &&
        center_lng <= region.longitude + region.longitudeDelta / 2 + margin
      );
    });
    
    console.log(`顯示 ${visibleHexagons.length}/${hexagons.length} 個六邊形`);
    return visibleHexagons;
  };

  const handleHexagonPress = (hexData: HexagonData) => {
    console.log('點擊六邊形:', hexData);
    onHexPress?.(hexData);
  };

  if (loading || !region) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        onRegionChangeComplete={handleRegionChange}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={false}
        showsScale={false}
        mapType="standard"
      >
        {getVisibleHexagons().map((hexData) => {
          const coordinates = getHexagonCoordinates(hexData);
          if (coordinates.length === 0) return null;

          // 根據音樂活躍度調整視覺效果
          const opacity = Math.max(0.3, Math.min(0.8, hexData.total_plays / 100));
          const strokeWidth = hexData.unique_users > 10 ? 3 : 2;
          
          return (
            <Polygon
              key={hexData.hex_id}
              coordinates={coordinates}
              fillColor={hexData.color_hex + Math.floor(opacity * 255).toString(16).padStart(2, '0')}
              strokeColor={hexData.color_hex}
              strokeWidth={strokeWidth}
              onPress={() => handleHexagonPress(hexData)}
              tappable={true}
            />
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    flex: 1,
  },
});