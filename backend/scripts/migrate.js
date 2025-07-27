const fs = require('fs').promises;
const path = require('path');
const { query, testConnection } = require('../config/database');

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

// 讀取並執行 SQL 檔案
async function executeSqlFile(filePath) {
  try {
    const sql = await fs.readFile(filePath, 'utf8');
    console.log(`📄 Executing: ${path.basename(filePath)}`);
    await query(sql);
    console.log(`✅ Completed: ${path.basename(filePath)}`);
  } catch (error) {
    console.error(`❌ Failed to execute ${path.basename(filePath)}:`, error.message);
    throw error;
  }
}

// 獲取已執行的 migrations
async function getExecutedMigrations() {
  try {
    const result = await query('SELECT version FROM migration_history ORDER BY version');
    return result.rows.map(row => row.version);
  } catch (error) {
    // 如果表不存在，返回空陣列
    return [];
  }
}

// 獲取所有 migration 檔案
async function getMigrationFiles() {
  try {
    const files = await fs.readdir(MIGRATIONS_DIR);
    return files
      .filter(file => file.endsWith('.sql'))
      .sort(); // 按檔名排序確保執行順序
  } catch (error) {
    console.error('Failed to read migrations directory:', error.message);
    return [];
  }
}

// 執行 migrations
async function runMigrations() {
  console.log('🚀 Starting database migrations...');

  // 測試資料庫連接
  const isConnected = await testConnection();
  if (!isConnected) {
    console.error('❌ Cannot connect to database. Exiting...');
    process.exit(1);
  }

  try {
    // 先執行初始化 migration
    const initFile = path.join(MIGRATIONS_DIR, '000_init.sql');
    try {
      await fs.access(initFile);
      await executeSqlFile(initFile);
    } catch (error) {
      // 如果檔案不存在，創建 migration_history 表
      await query(`
        CREATE TABLE IF NOT EXISTS migration_history (
          version VARCHAR(10) PRIMARY KEY,
          description TEXT,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // 獲取已執行的 migrations
    const executedMigrations = await getExecutedMigrations();
    console.log('📋 Already executed migrations:', executedMigrations);

    // 獲取所有 migration 檔案
    const migrationFiles = await getMigrationFiles();
    console.log('📁 Available migration files:', migrationFiles);

    // 執行未執行的 migrations
    for (const file of migrationFiles) {
      const version = file.replace('.sql', '');
      
      if (executedMigrations.includes(version)) {
        console.log(`⏭️  Skipping already executed migration: ${file}`);
        continue;
      }

      const filePath = path.join(MIGRATIONS_DIR, file);
      await executeSqlFile(filePath);
    }

    console.log('🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  }
}

// 重置資料庫 (危險操作)
async function resetDatabase() {
  console.log('⚠️  WARNING: This will drop all tables and data!');
  
  const dropTables = `
    DROP TABLE IF EXISTS user_sessions CASCADE;
    DROP TABLE IF EXISTS hex_top_tracks CASCADE;
    DROP TABLE IF EXISTS user_playback CASCADE;
    DROP TABLE IF EXISTS hex_properties CASCADE;
    DROP TABLE IF EXISTS tracks CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS migration_history CASCADE;
    DROP VIEW IF EXISTS v_popular_tracks;
    DROP VIEW IF EXISTS v_hex_activity;
    DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
  `;

  try {
    await query(dropTables);
    console.log('🗑️  All tables dropped successfully');
    await runMigrations();
  } catch (error) {
    console.error('💥 Reset failed:', error.message);
    process.exit(1);
  }
}

// 檢查 migration 狀態
async function checkMigrationStatus() {
  console.log('📊 Checking migration status...');
  
  try {
    const executedMigrations = await getExecutedMigrations();
    const migrationFiles = await getMigrationFiles();
    
    console.log('\n📋 Migration Status:');
    console.log('==================');
    
    for (const file of migrationFiles) {
      const version = file.replace('.sql', '');
      const status = executedMigrations.includes(version) ? '✅ Executed' : '⏳ Pending';
      console.log(`${file}: ${status}`);
    }
    
    const pendingCount = migrationFiles.length - executedMigrations.length;
    console.log(`\n📈 Total: ${migrationFiles.length} migrations, ${pendingCount} pending`);
    
  } catch (error) {
    console.error('💥 Status check failed:', error.message);
  }
}

// 命令行介面
const command = process.argv[2];

switch (command) {
  case 'up':
  case 'migrate':
    runMigrations();
    break;
  case 'reset':
    resetDatabase();
    break;
  case 'status':
    checkMigrationStatus();
    break;
  default:
    console.log(`
🗄️  SoundMate AR Database Migration Tool

Usage:
  node migrate.js up       - Run pending migrations
  node migrate.js reset    - Reset database (WARNING: drops all data)
  node migrate.js status   - Check migration status

Examples:
  npm run migrate          - Run migrations
  npm run db:reset         - Reset database
  npm run db:status        - Check status
    `);
}

module.exports = {
  runMigrations,
  resetDatabase,
  checkMigrationStatus
};