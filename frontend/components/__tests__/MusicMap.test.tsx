import React from 'react';
import { render } from '@testing-library/react-native';
import MusicMap from '../MusicMap';

// Mock react-native-maps
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  
  return {
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => <View testID="mapview" {...props} />),
    PROVIDER_GOOGLE: 'google',
    Polygon: (props: any) => <View testID="polygon" {...props} />,
  };
});

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: {
      latitude: 25.0330,
      longitude: 121.5654,
    },
  }),
  Accuracy: {
    High: 'high',
  },
}));

// Mock h3-js
jest.mock('h3-js', () => ({
  latLngToCell: jest.fn().mockReturnValue('891f1d4a5afffff'),
  h3ToGeoBoundary: jest.fn().mockReturnValue([
    [25.0330, 121.5654],
    [25.0335, 121.5660],
    [25.0340, 121.5655],
    [25.0335, 121.5650],
    [25.0330, 121.5645],
    [25.0325, 121.5650],
  ]),
}));

describe('MusicMap 組件測試', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('應該正確渲染地圖組件', () => {
    const mockOnHexPress = jest.fn();
    
    const { getByTestId } = render(
      <MusicMap onHexPress={mockOnHexPress} />
    );

    expect(getByTestId('mapview')).toBeTruthy();
  });

  it('應該處理位置權限被拒絕的情況', async () => {
    const mockOnHexPress = jest.fn();
    
    // Mock 權限被拒絕
    const expo = require('expo-location');
    expo.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

    const { getByTestId } = render(
      <MusicMap onHexPress={mockOnHexPress} />
    );

    // 組件應該仍然渲染，但使用預設位置
    expect(getByTestId('mapview')).toBeTruthy();
  });

  it('應該處理 H3 計算錯誤的情況', () => {
    const mockOnHexPress = jest.fn();
    
    // Mock H3 計算失敗
    const h3 = require('h3-js');
    h3.h3ToGeoBoundary.mockImplementationOnce(() => {
      throw new Error('H3 計算失敗');
    });

    const { getByTestId } = render(
      <MusicMap onHexPress={mockOnHexPress} />
    );

    // 組件應該仍然渲染
    expect(getByTestId('mapview')).toBeTruthy();
  });
});