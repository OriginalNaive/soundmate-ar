const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { logger } = require('./logger');

class SQLiteDatabase {
  constructor() {
    const isDev = process.env.NODE_ENV !== 'production';
    const isTest = process.env.NODE_ENV === 'test';
    
    // 根據環境選擇不同的資料庫檔案
    const dbName = isTest ? 'soundmate_ar_test.db' : 'soundmate_ar.db';
    this.dbPath = path.join(__dirname, '..', 'data', dbName);
    
    this.db = null;
    this.isConnected = false;
    
    if (isDev) {
      sqlite3.verbose();
    }
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error('SQLite 連線失敗:', err.message);
          reject(err);
        } else {
          this.isConnected = true;
          logger.info(`✅ SQLite 連線成功: ${this.dbPath}`);
          
          // 啟用外鍵約束
          this.db.run('PRAGMA foreign_keys = ON');
          
          resolve();
        }
      });
    });
  }

  async query(sql, params = []) {
    if (!this.isConnected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      const start = Date.now();
      
      // 判斷是 SELECT 還是其他操作
      const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
      
      if (isSelect) {
        this.db.all(sql, params, (err, rows) => {
          const duration = Date.now() - start;
          
          if (err) {
            logger.error('SQLite 查詢錯誤:', { sql: sql.substring(0, 50) + '...', error: err.message });
            reject(err);
          } else {
            logger.debug('SQLite 查詢完成', { 
              sql: sql.substring(0, 50) + '...', 
              duration, 
              rowCount: rows.length 
            });
            
            // 轉換為 PostgreSQL 風格的結果
            resolve({
              rows: rows,
              rowCount: rows.length,
              command: 'SELECT'
            });
          }
        });
      } else {
        this.db.run(sql, params, function(err) {
          const duration = Date.now() - start;
          
          if (err) {
            logger.error('SQLite 執行錯誤:', { sql: sql.substring(0, 50) + '...', error: err.message });
            reject(err);
          } else {
            logger.debug('SQLite 執行完成', { 
              sql: sql.substring(0, 50) + '...', 
              duration, 
              changes: this.changes,
              lastID: this.lastID
            });
            
            // 轉換為 PostgreSQL 風格的結果
            resolve({
              rows: [],
              rowCount: this.changes,
              command: sql.trim().split(' ')[0].toUpperCase(),
              lastID: this.lastID
            });
          }
        });
      }
    });
  }

  async getClient() {
    if (!this.isConnected) {
      await this.connect();
    }
    return {
      query: this.query.bind(this),
      release: () => {} // SQLite 不需要釋放連線
    };
  }

  async testConnection() {
    try {
      const result = await this.query('SELECT datetime() as current_time');
      logger.info('✅ SQLite 資料庫連線測試成功');
      logger.info(`   當前時間: ${result.rows[0].current_time}`);

      // 檢查表格數量
      const tablesResult = await this.query(`
        SELECT COUNT(*) as table_count 
        FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `);
      logger.info(`   表格數量: ${tablesResult.rows[0].table_count}`);

      // 檢查用戶數量
      const usersResult = await this.query('SELECT COUNT(*) as user_count FROM users');
      logger.info(`   用戶數量: ${usersResult.rows[0].user_count}`);

      // 檢查播放記錄數量
      const playbackResult = await this.query('SELECT COUNT(*) as playback_count FROM user_playback');
      logger.info(`   播放記錄數量: ${playbackResult.rows[0].playback_count}`);

      return true;
    } catch (err) {
      logger.error('❌ SQLite 資料庫連線測試失敗:', err.message);
      return false;
    }
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          logger.error('關閉 SQLite 連線時發生錯誤:', err.message);
        } else {
          logger.info('SQLite 連線已關閉');
          this.isConnected = false;
        }
      });
    }
  }
}

// 創建單例實例
const sqliteDb = new SQLiteDatabase();

// 優雅關閉處理
process.on('SIGTERM', () => {
  sqliteDb.close();
});

process.on('SIGINT', () => {
  sqliteDb.close();
});

module.exports = {
  query: sqliteDb.query.bind(sqliteDb),
  getClient: sqliteDb.getClient.bind(sqliteDb),
  testConnection: sqliteDb.testConnection.bind(sqliteDb),
  close: sqliteDb.close.bind(sqliteDb)
};