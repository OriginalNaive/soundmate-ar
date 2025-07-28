# 🚀 SoundMate AR 快速啟動指南

恭喜！您的 SoundMate AR 本地資料庫已經設置完成！

## ✅ 已完成設置

- ✅ **SQLite 資料庫**: 本地資料庫已創建並填入測試數據
- ✅ **測試用戶**: 2 個測試用戶已建立
- ✅ **測試歌曲**: 3 首熱門歌曲已添加
- ✅ **播放記錄**: 50 筆測試播放記錄
- ✅ **Hex 區域**: 31 個地理區域統計數據

## 📊 測試數據概覽

### 用戶數據
- **測試用戶1** (`test_user_1`) - 台北信義區
- **測試用戶2** (`test_user_2`) - 台北信義區

### 歌曲數據
- **As It Was** - Harry Styles
- **Anti-Hero** - Taylor Swift  
- **Flowers** - Miley Cyrus

### 地理數據
- **31 個 H3 六邊形區域** 覆蓋台北市範圍
- **播放熱點統計** 包含用戶數、播放次數等

## 🖥️ 啟動應用程序

### 1. 啟動後端服務

```bash
cd backend
npm run dev
```

後端服務將在 `http://localhost:5000` 啟動

### 2. 啟動前端應用

```bash
cd frontend
npm start
```

前端應用將在 Expo 中啟動

## 🔧 可用的 API 端點

- **健康檢查**: `GET http://localhost:5000/health`
- **地圖數據**: `GET http://localhost:5000/api/map/data?lat=25.0330&lng=121.5654&zoom=15`
- **播放歷史**: `GET http://localhost:5000/api/music/history`
- **Hex 詳情**: `GET http://localhost:5000/api/location/hex/{hex_id}`

## ⚡ 快速測試

### 測試 API 連線
```bash
curl http://localhost:5000/health
```

### 查看地圖數據
```bash
curl "http://localhost:5000/api/map/data?lat=25.0330&lng=121.5654&zoom=15"
```

## 🗃️ 資料庫管理

### 查看資料庫內容
```bash
cd backend
node -e "
const db = require('./config/sqlite-database');
db.query('SELECT COUNT(*) as count FROM user_playback')
  .then(result => console.log('播放記錄數:', result.rows[0].count));
"
```

### 重新生成測試數據
```bash
cd backend
node scripts/setup-sqlite.js
```

### 資料庫位置
- **主資料庫**: `backend/data/soundmate_ar.db`
- **測試資料庫**: `backend/data/soundmate_ar_test.db`

## 🧪 執行測試

### 後端測試
```bash
cd backend
npm test
```

### 前端測試
```bash
cd frontend
npm test
```

## 📱 前端功能

- **🏠 首頁**: 顯示當前播放狀態和位置
- **🗺️ 探索**: 互動式音樂地圖
- **📊 歷史**: 播放記錄和統計

## 🔧 開發工具

### 查看日誌
```bash
# 後端日誌
tail -f backend/logs/combined-$(date +%Y-%m-%d).log

# 前端 Metro bundler 日誌在終端中顯示
```

### 資料庫查詢工具
```bash
# 使用 SQLite 命令行
sqlite3 backend/data/soundmate_ar.db
.tables
SELECT * FROM users;
.quit
```

## 🚨 故障排除

### 後端無法啟動
1. 檢查 Node.js 版本 (`node --version`)
2. 重新安裝依賴 (`npm install`)
3. 檢查端口 5000 是否被占用

### 前端無法啟動
1. 確保 Expo CLI 已安裝 (`npm install -g @expo/cli`)
2. 重新安裝依賴 (`npm install`)
3. 清除緩存 (`npx expo start --clear`)

### 資料庫問題
1. 檢查資料庫檔案是否存在
2. 重新執行設置腳本
3. 檢查檔案權限

## 📈 下一步開發

1. **設置 Spotify API**: 在 `.env` 中配置真實的 Spotify 憑證
2. **添加更多測試數據**: 使用真實的音樂數據
3. **實現用戶認證**: 整合 Spotify OAuth
4. **擴展地圖功能**: 添加更多互動功能

## 🎵 享受開發！

您現在擁有一個完整的 SoundMate AR 開發環境，包含：
- 📊 豐富的測試數據
- 🔧 完整的 API 架構  
- 📱 跨平台前端應用
- 🗃️ 高效的本地資料庫

開始探索音樂與地理的奇妙結合吧！🎶🗺️