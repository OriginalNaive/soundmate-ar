import { useCallback, useRef } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  hexagonCount: number;
  memoryUsage?: number;
}

interface PerformanceMonitor {
  startRender: () => void;
  endRender: (hexagonCount: number) => void;
  logMetrics: () => void;
  getAverageRenderTime: () => number;
}

export const usePerformanceMonitor = (): PerformanceMonitor => {
  const renderStartTime = useRef<number>(0);
  const metricsHistory = useRef<PerformanceMetrics[]>([]);
  const maxHistorySize = 50; // 保持最近 50 次渲染記錄

  const startRender = useCallback(() => {
    renderStartTime.current = performance.now();
  }, []);

  const endRender = useCallback((hexagonCount: number) => {
    if (renderStartTime.current === 0) return;

    const renderTime = performance.now() - renderStartTime.current;
    
    // 記錄效能指標
    const metrics: PerformanceMetrics = {
      renderTime,
      hexagonCount,
    };

    // 如果支援記憶體 API，也記錄記憶體使用量
    if ('memory' in performance) {
      metrics.memoryUsage = (performance as any).memory.usedJSHeapSize;
    }

    // 更新歷史記錄
    metricsHistory.current.push(metrics);
    if (metricsHistory.current.length > maxHistorySize) {
      metricsHistory.current.shift();
    }

    // 重置計時器
    renderStartTime.current = 0;

    // 如果渲染時間過長，發出警告
    if (renderTime > 100) {
      console.warn(`🐌 地圖渲染較慢: ${renderTime.toFixed(2)}ms (${hexagonCount} 個六邊形)`);
    } else {
      console.log(`⚡ 地圖渲染: ${renderTime.toFixed(2)}ms (${hexagonCount} 個六邊形)`);
    }
  }, []);

  const logMetrics = useCallback(() => {
    if (metricsHistory.current.length === 0) {
      console.log('📊 尚無效能資料');
      return;
    }

    const recentMetrics = metricsHistory.current.slice(-10); // 最近 10 次
    const avgRenderTime = recentMetrics.reduce((sum, m) => sum + m.renderTime, 0) / recentMetrics.length;
    const avgHexagons = recentMetrics.reduce((sum, m) => sum + m.hexagonCount, 0) / recentMetrics.length;
    const maxRenderTime = Math.max(...recentMetrics.map(m => m.renderTime));
    const minRenderTime = Math.min(...recentMetrics.map(m => m.renderTime));

    console.log('📊 地圖效能統計 (最近 10 次):');
    console.log(`   平均渲染時間: ${avgRenderTime.toFixed(2)}ms`);
    console.log(`   最快渲染時間: ${minRenderTime.toFixed(2)}ms`);
    console.log(`   最慢渲染時間: ${maxRenderTime.toFixed(2)}ms`);
    console.log(`   平均六邊形數: ${avgHexagons.toFixed(0)}`);

    if (recentMetrics[0]?.memoryUsage) {
      const avgMemory = recentMetrics
        .filter(m => m.memoryUsage)
        .reduce((sum, m) => sum + (m.memoryUsage || 0), 0) / recentMetrics.length;
      console.log(`   平均記憶體使用: ${(avgMemory / 1024 / 1024).toFixed(2)} MB`);
    }
  }, []);

  const getAverageRenderTime = useCallback(() => {
    if (metricsHistory.current.length === 0) return 0;
    
    const recentMetrics = metricsHistory.current.slice(-10);
    return recentMetrics.reduce((sum, m) => sum + m.renderTime, 0) / recentMetrics.length;
  }, []);

  return {
    startRender,
    endRender,
    logMetrics,
    getAverageRenderTime,
  };
};