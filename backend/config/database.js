// 根據環境變數決定使用哪個資料庫
const dbType = process.env.DB_TYPE || 'postgresql';

if (dbType === 'sqlite') {
  // 使用 SQLite
  const sqliteDb = require('./sqlite-database');
  
  module.exports = {
    query: sqliteDb.query,
    getClient: sqliteDb.getClient,
    testConnection: sqliteDb.testConnection,
    close: sqliteDb.close
  };
  
} else {
  // 使用 PostgreSQL (原有邏輯)
  const { Pool } = require('pg');
  
  const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'soundmate_ar',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT) || 5432,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  const pool = new Pool(dbConfig);

  // 連接錯誤處理
  pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });

  // 測試資料庫連接
  const testConnection = async () => {
    // 在測試環境中模擬成功連線
    if (process.env.MOCK_DATABASE === 'true') {
      console.log('✅ Database connected successfully (mocked for testing)');
      return true;
    }
    
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW()');
      console.log('✅ Database connected successfully:', result.rows[0].now);
      client.release();
      return true;
    } catch (err) {
      console.error('❌ Database connection failed:', err.message);
      return false;
    }
  };

  // 執行查詢的輔助函數
  const query = async (text, params) => {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text: text.substring(0, 50) + '...', duration, rows: res.rowCount });
      return res;
    } catch (err) {
      console.error('Query error:', { text: text.substring(0, 50) + '...', error: err.message });
      throw err;
    }
  };

  // 獲取客戶端連接
  const getClient = async () => {
    return await pool.connect();
  };

  module.exports = {
    pool,
    query,
    getClient,
    testConnection
  };
}