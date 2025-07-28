const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const h3 = require('h3-js');

const logger = console;

class SQLiteSetup {
  constructor() {
    this.dbPath = path.join(__dirname, '..', 'data', 'soundmate_ar.db');
    this.testDbPath = path.join(__dirname, '..', 'data', 'soundmate_ar_test.db');
    
    // 確保資料夾存在
    this.ensureDataDir();
  }

  async ensureDataDir() {
    const dataDir = path.dirname(this.dbPath);
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      // 目錄已存在或其他錯誤
    }
  }

  async createDatabase(dbPath) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          logger.info(`✅ 資料庫創建成功: ${dbPath}`);
          resolve(db);
        }
      });
    });
  }

  async runMigrations(db) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // 創建用戶表
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            spotify_id TEXT UNIQUE NOT NULL,
            display_name TEXT,
            email TEXT,
            profile_image_url TEXT,
            access_token TEXT,
            refresh_token TEXT,
            token_expires_at DATETIME,
            latitude REAL,
            longitude REAL,
            last_location_update DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // 創建歌曲表
        db.run(`
          CREATE TABLE IF NOT EXISTS tracks (
            id TEXT PRIMARY KEY,
            spotify_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            artist_name TEXT NOT NULL,
            album_name TEXT,
            duration_ms INTEGER,
            popularity INTEGER,
            preview_url TEXT,
            external_urls TEXT,
            audio_features TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // 創建播放記錄表
        db.run(`
          CREATE TABLE IF NOT EXISTS user_playback (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            track_id TEXT NOT NULL,
            track_name TEXT NOT NULL,
            artist_name TEXT NOT NULL,
            album_name TEXT,
            duration_ms INTEGER,
            hex_id TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            played_at DATETIME NOT NULL,
            audio_features TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(spotify_id)
          )
        `);

        // 創建 H3 六邊形屬性表
        db.run(`
          CREATE TABLE IF NOT EXISTS hex_properties (
            id TEXT PRIMARY KEY,
            hex_id TEXT UNIQUE NOT NULL,
            center_lat REAL NOT NULL,
            center_lng REAL NOT NULL,
            total_plays INTEGER DEFAULT 0,
            unique_users INTEGER DEFAULT 0,
            unique_tracks INTEGER DEFAULT 0,
            avg_energy REAL,
            avg_valence REAL,
            avg_danceability REAL,
            avg_tempo REAL,
            dominant_genre TEXT,
            color_hex TEXT,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // 創建 H3 熱門歌曲表
        db.run(`
          CREATE TABLE IF NOT EXISTS hex_top_tracks (
            id TEXT PRIMARY KEY,
            hex_id TEXT NOT NULL,
            track_id TEXT NOT NULL,
            track_name TEXT NOT NULL,
            artist_name TEXT NOT NULL,
            play_count INTEGER DEFAULT 1,
            rank_score REAL DEFAULT 0,
            last_played DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(hex_id, track_id)
          )
        `);

        // 創建索引
        db.run('CREATE INDEX IF NOT EXISTS idx_users_spotify_id ON users(spotify_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_playback_user_id ON user_playback(user_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_playback_hex_id ON user_playback(hex_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_playback_played_at ON user_playback(played_at)');
        db.run('CREATE INDEX IF NOT EXISTS idx_hex_properties_hex_id ON hex_properties(hex_id)');

        db.run('SELECT 1', (err) => {
          if (err) {
            reject(err);
          } else {
            logger.info('✅ 資料庫遷移完成');
            resolve();
          }
        });
      });
    });
  }

  async generateTestData(db) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // 創建測試用戶
        const users = [
          {
            id: 'user1',
            spotify_id: 'test_user_1',
            display_name: '測試用戶1',
            email: 'test1@example.com',
            latitude: 25.0330,
            longitude: 121.5654,
            access_token: 'test_token_1',
            refresh_token: 'test_refresh_1'
          },
          {
            id: 'user2',
            spotify_id: 'test_user_2',
            display_name: '測試用戶2',
            email: 'test2@example.com',
            latitude: 25.0340,
            longitude: 121.5664,
            access_token: 'test_token_2',
            refresh_token: 'test_refresh_2'
          }
        ];

        const userStmt = db.prepare(`
          INSERT OR REPLACE INTO users 
          (id, spotify_id, display_name, email, latitude, longitude, access_token, refresh_token)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        users.forEach(user => {
          userStmt.run([
            user.id, user.spotify_id, user.display_name, user.email,
            user.latitude, user.longitude, user.access_token, user.refresh_token
          ]);
        });
        userStmt.finalize();

        // 創建測試歌曲
        const tracks = [
          {
            id: 'track1',
            spotify_id: '4iV5W9uYEdYUVa79Axb7Rh',
            name: 'As It Was',
            artist_name: 'Harry Styles',
            album_name: "Harry's House",
            duration_ms: 167000,
            audio_features: JSON.stringify({
              energy: 0.65,
              valence: 0.43,
              danceability: 0.70,
              tempo: 173.0
            })
          },
          {
            id: 'track2',
            spotify_id: '0V3wPSX9ygBnCm8psDIegu',
            name: 'Anti-Hero',
            artist_name: 'Taylor Swift',
            album_name: 'Midnights',
            duration_ms: 200000,
            audio_features: JSON.stringify({
              energy: 0.59,
              valence: 0.33,
              danceability: 0.66,
              tempo: 97.0
            })
          },
          {
            id: 'track3',
            spotify_id: '7Hk5pM95vjKOEe7MgL7Gfj',
            name: 'Flowers',
            artist_name: 'Miley Cyrus',
            album_name: 'Endless Summer Vacation',
            duration_ms: 200667,
            audio_features: JSON.stringify({
              energy: 0.70,
              valence: 0.55,
              danceability: 0.69,
              tempo: 96.0
            })
          }
        ];

        const trackStmt = db.prepare(`
          INSERT OR REPLACE INTO tracks 
          (id, spotify_id, name, artist_name, album_name, duration_ms, audio_features)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        tracks.forEach(track => {
          trackStmt.run([
            track.id, track.spotify_id, track.name, track.artist_name,
            track.album_name, track.duration_ms, track.audio_features
          ]);
        });
        trackStmt.finalize();

        // 創建測試播放記錄
        const playbackStmt = db.prepare(`
          INSERT OR REPLACE INTO user_playback 
          (id, user_id, track_id, track_name, artist_name, album_name, duration_ms, hex_id, latitude, longitude, played_at, audio_features)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (let i = 0; i < 50; i++) {
          const user = users[Math.floor(Math.random() * users.length)];
          const track = tracks[Math.floor(Math.random() * tracks.length)];
          
          // 生成隨機位置（台北市範圍內）
          const lat = 25.0330 + (Math.random() - 0.5) * 0.02;
          const lng = 121.5654 + (Math.random() - 0.5) * 0.02;
          const hex_id = h3.latLngToCell(lat, lng, 9);
          
          // 生成隨機時間（過去7天內）
          const played_at = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString();
          
          playbackStmt.run([
            `playback_${i}`, user.spotify_id, track.spotify_id, track.name, track.artist_name,
            track.album_name, track.duration_ms, hex_id, lat, lng, played_at, track.audio_features
          ]);
        }
        playbackStmt.finalize();

        // 生成 Hex 統計數據
        db.all(`
          SELECT 
            hex_id,
            COUNT(*) as total_plays,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(DISTINCT track_id) as unique_tracks,
            AVG(latitude) as center_lat,
            AVG(longitude) as center_lng
          FROM user_playback 
          GROUP BY hex_id
        `, (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          const hexStmt = db.prepare(`
            INSERT OR REPLACE INTO hex_properties 
            (id, hex_id, center_lat, center_lng, total_plays, unique_users, unique_tracks, color_hex)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);

          rows.forEach((row, index) => {
            hexStmt.run([
              `hex_${index}`, row.hex_id, row.center_lat, row.center_lng,
              row.total_plays, row.unique_users, row.unique_tracks, '#1DB954'
            ]);
          });
          hexStmt.finalize();

          logger.info('✅ 測試數據生成完成');
          logger.info(`   - ${users.length} 個測試用戶`);
          logger.info(`   - ${tracks.length} 首測試歌曲`);
          logger.info(`   - 50 筆播放記錄`);
          logger.info(`   - ${rows.length} 個 Hex 區域`);
          
          resolve();
        });
      });
    });
  }

  async testConnection(db) {
    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (err) {
          reject(err);
        } else {
          logger.info(`✅ 資料庫連線測試成功`);
          logger.info(`   用戶數量: ${row.count}`);
          
          db.get('SELECT COUNT(*) as count FROM user_playback', (err, row) => {
            if (err) {
              reject(err);
            } else {
              logger.info(`   播放記錄數量: ${row.count}`);
              resolve();
            }
          });
        }
      });
    });
  }

  async setupComplete() {
    try {
      logger.info('🚀 開始設置 SoundMate AR SQLite 資料庫...\n');

      // 1. 創建主資料庫
      const mainDb = await this.createDatabase(this.dbPath);
      
      // 2. 創建測試資料庫
      const testDb = await this.createDatabase(this.testDbPath);

      // 3. 執行主資料庫遷移
      await this.runMigrations(mainDb);
      
      // 4. 執行測試資料庫遷移
      await this.runMigrations(testDb);

      // 5. 生成測試數據（只在主資料庫）
      await this.generateTestData(mainDb);

      // 6. 測試連線
      await this.testConnection(mainDb);

      // 關閉資料庫連線
      mainDb.close();
      testDb.close();

      logger.info('\n🎉 SQLite 資料庫設置完成！');
      logger.info(`主資料庫: ${this.dbPath}`);
      logger.info(`測試資料庫: ${this.testDbPath}`);
      logger.info('\n您現在可以啟動應用程序了！');

    } catch (error) {
      logger.error('\n💥 資料庫設置失敗:', error.message);
      process.exit(1);
    }
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  const setup = new SQLiteSetup();
  setup.setupComplete();
}

module.exports = SQLiteSetup;