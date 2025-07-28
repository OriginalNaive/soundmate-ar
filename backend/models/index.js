// 模型適配器 - 根據資料庫類型選擇對應的模型
const dbType = process.env.DB_TYPE || 'postgresql';

let models = {};

if (dbType === 'sqlite') {
  // SQLite 模型
  models = {
    HexProperty: require('./sqlite/HexProperty'),
    // SQLite 使用相同的其他模型
    Playback: require('./Playback'),
    Track: require('./Track'),
    User: require('./User'),
    HexTopTrack: require('./HexTopTrack'),
  };
} else {
  // PostgreSQL 模型 (原有模型)
  models = {
    HexProperty: require('./HexProperty'),
    Playback: require('./Playback'),
    Track: require('./Track'),
    User: require('./User'),
    HexTopTrack: require('./HexTopTrack'),
  };
}

module.exports = models;