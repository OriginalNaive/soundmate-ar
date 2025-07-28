const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const logger = console;

class DatabaseSetup {
  constructor() {
    // 管理員連線配置（連接到 postgres 系統資料庫）
    this.adminConfig = {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: 'postgres', // 連接到系統資料庫
      password: process.env.DB_PASSWORD || 'postgres',
      port: parseInt(process.env.DB_PORT) || 5432,
    };

    this.dbName = process.env.DB_NAME || 'soundmate_ar';
    this.testDbName = `${this.dbName}_test`;
  }

  async createDatabase(dbName) {
    const client = new Client(this.adminConfig);
    
    try {
      await client.connect();
      logger.info(`正在創建資料庫: ${dbName}`);

      // 檢查資料庫是否存在
      const checkResult = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [dbName]
      );

      if (checkResult.rows.length === 0) {
        // 創建資料庫
        await client.query(`CREATE DATABASE "${dbName}"`);
        logger.info(`✅ 資料庫 ${dbName} 創建成功`);
      } else {
        logger.info(`📋 資料庫 ${dbName} 已存在`);
      }
    } catch (error) {
      logger.error(`❌ 創建資料庫失敗: ${error.message}`);
      throw error;
    } finally {
      await client.end();
    }
  }

  async runMigrations(dbName) {
    const client = new Client({
      ...this.adminConfig,
      database: dbName
    });

    try {
      await client.connect();
      logger.info(`正在執行 ${dbName} 的資料庫遷移...`);

      // 讀取遷移文件
      const migrationsDir = path.join(__dirname, '..', 'migrations');
      const migrationFiles = await fs.readdir(migrationsDir);
      const sqlFiles = migrationFiles
        .filter(file => file.endsWith('.sql'))
        .sort(); // 確保按順序執行

      // 創建遷移記錄表
      await client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          filename VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 執行每個遷移文件
      for (const file of sqlFiles) {
        // 檢查是否已執行
        const existsResult = await client.query(
          'SELECT 1 FROM migrations WHERE filename = $1',
          [file]
        );

        if (existsResult.rows.length === 0) {
          logger.info(`執行遷移: ${file}`);
          
          const filePath = path.join(migrationsDir, file);
          const sql = await fs.readFile(filePath, 'utf8');
          
          await client.query(sql);
          
          // 記錄遷移
          await client.query(
            'INSERT INTO migrations (filename) VALUES ($1)',
            [file]
          );
          
          logger.info(`✅ 遷移 ${file} 執行成功`);
        } else {
          logger.info(`⏭️ 遷移 ${file} 已執行，跳過`);
        }
      }

      logger.info(`🎉 ${dbName} 資料庫遷移完成`);
    } catch (error) {
      logger.error(`❌ 資料庫遷移失敗: ${error.message}`);
      throw error;
    } finally {
      await client.end();
    }
  }

  async generateTestData(dbName) {
    const client = new Client({
      ...this.adminConfig,
      database: dbName
    });

    try {
      await client.connect();
      logger.info(`正在為 ${dbName} 生成測試數據...`);

      // 創建測試用戶
      const users = [
        {
          spotify_id: 'test_user_1',
          display_name: '測試用戶1',
          email: 'test1@example.com',
          latitude: 25.0330,
          longitude: 121.5654,
          access_token: 'test_token_1',
          refresh_token: 'test_refresh_1'
        },
        {
          spotify_id: 'test_user_2', 
          display_name: '測試用戶2',
          email: 'test2@example.com',
          latitude: 25.0340,
          longitude: 121.5664,
          access_token: 'test_token_2',
          refresh_token: 'test_refresh_2'
        }
      ];

      for (const user of users) {
        await client.query(`
          INSERT INTO users (spotify_id, display_name, email, latitude, longitude, access_token, refresh_token)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (spotify_id) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude
        `, [user.spotify_id, user.display_name, user.email, user.latitude, user.longitude, user.access_token, user.refresh_token]);
      }

      // 創建測試歌曲
      const tracks = [
        {
          spotify_id: '4iV5W9uYEdYUVa79Axb7Rh',
          name: 'As It Was',
          artist: 'Harry Styles',
          album: "Harry's House",
          duration_ms: 167000,
          audio_features: {
            energy: 0.65,
            valence: 0.43,
            danceability: 0.70,
            tempo: 173.0
          }
        },
        {
          spotify_id: '0V3wPSX9ygBnCm8psDIegu',
          name: 'Anti-Hero',
          artist: 'Taylor Swift',
          album: 'Midnights',
          duration_ms: 200000,
          audio_features: {
            energy: 0.59,
            valence: 0.33,
            danceability: 0.66,
            tempo: 97.0
          }
        },
        {
          spotify_id: '7Hk5pM95vjKOEe7MgL7Gfj',
          name: 'Flowers',
          artist: 'Miley Cyrus',
          album: 'Endless Summer Vacation',
          duration_ms: 200667,
          audio_features: {
            energy: 0.70,
            valence: 0.55,
            danceability: 0.69,
            tempo: 96.0
          }
        }
      ];

      for (const track of tracks) {
        await client.query(`
          INSERT INTO tracks (spotify_id, name, artist_name, album_name, duration_ms, audio_features)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (spotify_id) DO UPDATE SET
            name = EXCLUDED.name,
            artist_name = EXCLUDED.artist_name,
            album_name = EXCLUDED.album_name,
            duration_ms = EXCLUDED.duration_ms,
            audio_features = EXCLUDED.audio_features
        `, [track.spotify_id, track.name, track.artist, track.album, track.duration_ms, JSON.stringify(track.audio_features)]);
      }

      // 創建測試播放記錄
      const h3 = require('h3-js');
      const playbackRecords = [];
      
      for (let i = 0; i < 50; i++) {
        const user = users[Math.floor(Math.random() * users.length)];
        const track = tracks[Math.floor(Math.random() * tracks.length)];
        
        // 生成隨機位置（台北市範圍內）
        const lat = 25.0330 + (Math.random() - 0.5) * 0.02;
        const lng = 121.5654 + (Math.random() - 0.5) * 0.02;
        const hex_id = h3.latLngToCell(lat, lng, 9);
        
        // 生成隨機時間（過去7天內）
        const played_at = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
        
        playbackRecords.push({
          user_id: user.spotify_id,
          track_id: track.spotify_id,
          track_name: track.name,
          artist_name: track.artist,
          album_name: track.album,
          duration_ms: track.duration_ms,
          hex_id,
          latitude: lat,
          longitude: lng,
          played_at,
          audio_features: track.audio_features
        });
      }

      for (const record of playbackRecords) {
        await client.query(`
          INSERT INTO user_playback (
            user_id, track_id, track_name, artist_name, album_name,
            duration_ms, hex_id, latitude, longitude, played_at, audio_features
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          record.user_id, record.track_id, record.track_name, record.artist_name,
          record.album_name, record.duration_ms, record.hex_id, record.latitude,
          record.longitude, record.played_at, JSON.stringify(record.audio_features)
        ]);
      }

      logger.info('✅ 測試數據生成完成');
      logger.info(`   - ${users.length} 個測試用戶`);
      logger.info(`   - ${tracks.length} 首測試歌曲`);
      logger.info(`   - ${playbackRecords.length} 筆播放記錄`);

    } catch (error) {
      logger.error(`❌ 生成測試數據失敗: ${error.message}`);
      throw error;
    } finally {
      await client.end();
    }
  }

  async testConnection(dbName) {
    const client = new Client({
      ...this.adminConfig,
      database: dbName
    });

    try {
      await client.connect();
      
      // 測試基本查詢
      const result = await client.query('SELECT NOW() as current_time');
      logger.info(`✅ 資料庫 ${dbName} 連線測試成功`);
      logger.info(`   當前時間: ${result.rows[0].current_time}`);

      // 檢查表格數量
      const tablesResult = await client.query(`
        SELECT COUNT(*) as table_count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      logger.info(`   表格數量: ${tablesResult.rows[0].table_count}`);

      // 檢查用戶數量
      const usersResult = await client.query('SELECT COUNT(*) as user_count FROM users');
      logger.info(`   用戶數量: ${usersResult.rows[0].user_count}`);

      // 檢查播放記錄數量
      const playbackResult = await client.query('SELECT COUNT(*) as playback_count FROM user_playback');
      logger.info(`   播放記錄數量: ${playbackResult.rows[0].playback_count}`);

    } catch (error) {
      logger.error(`❌ 資料庫連線測試失敗: ${error.message}`);
      throw error;
    } finally {
      await client.end();
    }
  }

  async setupComplete() {
    try {
      logger.info('🚀 開始設置 SoundMate AR 本地資料庫...\n');

      // 1. 創建主資料庫
      await this.createDatabase(this.dbName);
      
      // 2. 創建測試資料庫
      await this.createDatabase(this.testDbName);

      // 3. 執行主資料庫遷移
      await this.runMigrations(this.dbName);
      
      // 4. 執行測試資料庫遷移
      await this.runMigrations(this.testDbName);

      // 5. 生成測試數據（只在主資料庫）
      await this.generateTestData(this.dbName);

      // 6. 測試連線
      await this.testConnection(this.dbName);
      await this.testConnection(this.testDbName);

      logger.info('\n🎉 資料庫設置完成！');
      logger.info(`主資料庫: ${this.dbName}`);
      logger.info(`測試資料庫: ${this.testDbName}`);
      logger.info('\n您現在可以啟動應用程序了！');

    } catch (error) {
      logger.error('\n💥 資料庫設置失敗:', error.message);
      process.exit(1);
    }
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  const setup = new DatabaseSetup();
  setup.setupComplete();
}

module.exports = DatabaseSetup;