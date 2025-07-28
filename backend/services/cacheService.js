const { logger } = require('../config/logger');

class CacheService {
  constructor() {
    // 內存緩存儲存
    this.cache = new Map();
    this.defaultTTL = 300000; // 5分鐘預設過期時間
    this.maxSize = 1000; // 最大緩存項目數
    
    // 定期清理過期緩存
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // 每分鐘清理一次
    
    logger.info('緩存服務已啟動', {
      defaultTTL: this.defaultTTL,
      maxSize: this.maxSize
    });
  }

  /**
   * 設置緩存
   * @param {string} key - 緩存鍵
   * @param {any} value - 緩存值
   * @param {number} ttl - 過期時間（毫秒）
   */
  set(key, value, ttl = this.defaultTTL) {
    // 如果緩存已滿，刪除最舊的項目
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      logger.debug('緩存已滿，刪除最舊項目', { deletedKey: firstKey });
    }

    const expiresAt = Date.now() + ttl;
    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now()
    });

    logger.debug('緩存已設置', { 
      key, 
      ttl, 
      expiresAt: new Date(expiresAt).toISOString(),
      cacheSize: this.cache.size 
    });
  }

  /**
   * 獲取緩存
   * @param {string} key - 緩存鍵
   * @returns {any|null} 緩存值或null
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      logger.debug('緩存未命中', { key });
      return null;
    }

    // 檢查是否過期
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      logger.debug('緩存已過期', { key });
      return null;
    }

    logger.debug('緩存命中', { 
      key,
      age: Date.now() - item.createdAt 
    });
    return item.value;
  }

  /**
   * 刪除緩存
   * @param {string} key - 緩存鍵
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug('緩存已刪除', { key });
    }
    return deleted;
  }

  /**
   * 清空所有緩存
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('所有緩存已清空', { previousSize: size });
  }

  /**
   * 清理過期緩存
   */
  cleanup() {
    const now = Date.now();
    let deletedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      logger.debug('清理過期緩存', { 
        deletedCount, 
        remainingSize: this.cache.size 
      });
    }
  }

  /**
   * 獲取緩存統計信息
   */
  getStats() {
    const stats = {
      size: this.cache.size,
      maxSize: this.maxSize,
      usagePercentage: (this.cache.size / this.maxSize * 100).toFixed(2)
    };

    logger.debug('緩存統計', stats);
    return stats;
  }

  /**
   * 包裝函數以提供緩存功能
   * @param {string} key - 緩存鍵
   * @param {Function} fn - 要執行的函數
   * @param {number} ttl - 緩存過期時間
   */
  async wrap(key, fn, ttl = this.defaultTTL) {
    // 先嘗試從緩存獲取
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    try {
      // 執行函數獲取新數據
      const result = await fn();
      // 將結果存入緩存
      this.set(key, result, ttl);
      return result;
    } catch (error) {
      logger.error('緩存包裝函數執行失敗', { key, error: error.message });
      throw error;
    }
  }

  /**
   * 關閉緩存服務
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
    logger.info('緩存服務已關閉');
  }
}

// 創建單例實例
const cacheService = new CacheService();

// 優雅關閉處理
process.on('SIGTERM', () => {
  cacheService.shutdown();
});

process.on('SIGINT', () => {
  cacheService.shutdown();
});

module.exports = cacheService;