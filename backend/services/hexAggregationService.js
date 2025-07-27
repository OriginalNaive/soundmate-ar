const { logger } = require('../config/logger');
const HexProperty = require('../models/HexProperty');

class HexAggregationService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.updateInterval = 5 * 60 * 1000; // 5 分鐘
  }

  /**
   * 啟動聚合服務
   */
  start() {
    if (this.isRunning) {
      logger.warn('Hex 聚合服務已在運行');
      return;
    }

    this.isRunning = true;
    logger.info('Hex 聚合服務啟動');

    // 立即執行一次
    this.runAggregation();

    // 設定定期執行
    this.intervalId = setInterval(() => {
      this.runAggregation();
    }, this.updateInterval);
  }

  /**
   * 停止聚合服務
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('Hex 聚合服務已停止');
  }

  /**
   * 執行聚合更新
   */
  async runAggregation() {
    try {
      const startTime = Date.now();
      
      // 獲取需要更新的 hex 列表
      const hexIds = await HexProperty.getHexesNeedingFeatureUpdate(20);
      
      if (hexIds.length === 0) {
        logger.debug('沒有需要更新的 hex');
        return;
      }

      logger.info(`開始更新 ${hexIds.length} 個 hex 的聚合特徵`);

      // 批量更新
      const results = await HexProperty.batchUpdateAggregateFeatures(hexIds);
      
      const duration = Date.now() - startTime;
      const successCount = results.length;
      
      logger.info('Hex 聚合更新完成', {
        processedHexes: hexIds.length,
        successfulUpdates: successCount,
        failedUpdates: hexIds.length - successCount,
        duration: `${duration}ms`,
        hexIds: hexIds.slice(0, 5) // 只記錄前 5 個用於除錯
      });

      // 記錄效能指標
      if (duration > 30000) { // 超過 30 秒警告
        logger.warn('Hex 聚合更新耗時過長', {
          duration: `${duration}ms`,
          hexCount: hexIds.length
        });
      }

    } catch (error) {
      logger.error('Hex 聚合更新失敗:', error.message);
    }
  }

  /**
   * 手動觸發單個 hex 聚合更新
   * @param {string} hexId - Hex ID
   */
  async updateSingleHex(hexId) {
    try {
      logger.debug(`手動更新 hex ${hexId}`);
      const result = await HexProperty.updateAggregateFeatures(hexId);
      
      if (result) {
        logger.info(`Hex ${hexId} 手動更新成功`, {
          color: result.color_hex,
          energy: result.avg_energy,
          valence: result.avg_valence
        });
      }
      
      return result;
    } catch (error) {
      logger.error(`手動更新 hex ${hexId} 失敗:`, error.message);
      throw error;
    }
  }

  /**
   * 取得服務狀態
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      updateInterval: this.updateInterval,
      nextUpdateIn: this.intervalId ? this.updateInterval : null
    };
  }

  /**
   * 強制執行完整聚合 (維護用)
   * @param {number} limit - 處理的 hex 數量限制
   */
  async forceFullAggregation(limit = 100) {
    try {
      logger.info(`開始強制完整聚合 (限制: ${limit} hex)`);
      const startTime = Date.now();

      // 獲取所有活躍的 hex
      const activeHexes = await HexProperty.getActiveHexes(limit);
      const hexIds = activeHexes.map(hex => hex.hex_id);

      if (hexIds.length === 0) {
        logger.info('沒有活躍的 hex 需要處理');
        return { processed: 0, success: 0, failed: 0 };
      }

      // 分批處理 (每批 10 個)
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < hexIds.length; i += batchSize) {
        batches.push(hexIds.slice(i, i + batchSize));
      }

      let totalSuccess = 0;
      let totalFailed = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        logger.debug(`處理批次 ${i + 1}/${batches.length} (${batch.length} hex)`);
        
        const results = await HexProperty.batchUpdateAggregateFeatures(batch);
        totalSuccess += results.length;
        totalFailed += batch.length - results.length;

        // 批次間延遲，避免過載
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const duration = Date.now() - startTime;
      
      logger.info('強制完整聚合完成', {
        totalProcessed: hexIds.length,
        totalSuccess,
        totalFailed,
        duration: `${duration}ms`,
        averagePerHex: `${Math.round(duration / hexIds.length)}ms`
      });

      return {
        processed: hexIds.length,
        success: totalSuccess,
        failed: totalFailed,
        duration
      };

    } catch (error) {
      logger.error('強制完整聚合失敗:', error.message);
      throw error;
    }
  }
}

// 建立單例實例
const hexAggregationService = new HexAggregationService();

module.exports = hexAggregationService;