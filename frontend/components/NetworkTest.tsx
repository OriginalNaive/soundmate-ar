import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { API_BASE_URL, fetchWithRetry } from '@/config/api';

export default function NetworkTest() {
  const [testResult, setTestResult] = useState<string>('尚未測試');
  const [testing, setTesting] = useState(false);

  const runNetworkTest = async () => {
    setTesting(true);
    setTestResult('測試中...');

    try {
      console.log(`🧪 開始網路測試，連接到: ${API_BASE_URL}`);
      
      // 測試健康檢查端點
      const healthResponse = await fetchWithRetry(`${API_BASE_URL.replace('/api', '')}/health`);
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        console.log('✅ 健康檢查成功:', healthData);
        
        // 測試地圖API
        const mapResponse = await fetchWithRetry(
          `${API_BASE_URL}/map/data?lat=25.033&lng=121.5654&zoom=15`
        );
        
        if (mapResponse.ok) {
          const mapData = await mapResponse.json();
          console.log('✅ 地圖API成功:', mapData.data.hexagons.length, '個六邊形');
          
          setTestResult(`✅ 連接成功！
服務器版本: ${healthData.data.version}
六邊形數量: ${mapData.data.hexagons.length}
API地址: ${API_BASE_URL}`);
        } else {
          throw new Error(`地圖API失敗: ${mapResponse.status}`);
        }
      } else {
        throw new Error(`健康檢查失敗: ${healthResponse.status}`);
      }
    } catch (error: any) {
      console.error('❌ 網路測試失敗:', error);
      setTestResult(`❌ 連接失敗: ${error.message}
嘗試連接: ${API_BASE_URL}
建議檢查:
1. 電腦和手機在同一WiFi網路
2. 防火牆設定允許5000端口
3. 服務器正在運行`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🌐 網路連接測試</Text>
      
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>目標API: {API_BASE_URL}</Text>
      </View>

      <TouchableOpacity 
        style={[styles.testButton, testing && styles.testButtonDisabled]} 
        onPress={runNetworkTest}
        disabled={testing}
      >
        <Text style={styles.testButtonText}>
          {testing ? '測試中...' : '開始網路測試'}
        </Text>
      </TouchableOpacity>

      <View style={styles.resultBox}>
        <Text style={styles.resultText}>{testResult}</Text>
      </View>

      <TouchableOpacity 
        style={styles.copyButton} 
        onPress={() => {
          Alert.alert('API資訊', `API地址: ${API_BASE_URL}\n電腦IP: 192.168.1.106\n端口: 5000`);
        }}
      >
        <Text style={styles.copyButtonText}>📋 查看API資訊</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  infoText: {
    fontSize: 12,
    color: '#1976d2',
    textAlign: 'center',
  },
  testButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  testButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultBox: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 15,
    minHeight: 120,
  },
  resultText: {
    fontSize: 14,
    lineHeight: 20,
  },
  copyButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
  },
  copyButtonText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
  },
});