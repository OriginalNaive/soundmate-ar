# 🧪 SoundMate AR 完整測試指南

## 📋 測試前檢查清單

### ✅ 必要軟體
- [x] Node.js (已安裝 v22.16.0)
- [x] npm (已安裝 v10.9.2) 
- [x] PostgreSQL (已安裝 v13.21)
- [ ] **Spotify 開發者帳號和 API 憑證**

### 🎵 Spotify API 設置 (必須完成)

1. **前往 Spotify 開發者控制台**:
   ```
   https://developer.spotify.com/dashboard
   ```

2. **創建新應用**:
   - App name: `SoundMate AR Test`
   - App description: `Location-based music discovery`
   - Redirect URI: `http://localhost:5000/api/auth/spotify/callback`

3. **複製憑證到 .env 檔案**:
   ```bash
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   ```

## 🗄 資料庫設置

### 選項 1: 使用現有 PostgreSQL

如果您已經有 PostgreSQL：

1. **創建資料庫**:
```sql
-- 連接到 PostgreSQL
psql -U postgres

-- 創建資料庫
CREATE DATABASE soundmate_ar;

-- 退出
\q
```

2. **更新 .env 檔案**:
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=soundmate_ar
DB_USER=postgres
DB_PASSWORD=your_postgres_password
```

### 選項 2: 使用 Docker (推薦)

如果您想要乾淨的測試環境：

```bash
# 啟動 PostgreSQL 容器
docker run --name soundmate-db -e POSTGRES_PASSWORD=testpass -e POSTGRES_DB=soundmate_ar -p 5432:5432 -d postgres:13

# 更新 .env
DB_PASSWORD=testpass
```

## 🚀 後端測試步驟

### 1. 安裝依賴
```bash
cd backend
npm install
```

### 2. 執行資料庫遷移
```bash
npm run migrate
```

### 3. 啟動後端服務器
```bash
npm run dev
```

### 4. 測試基本 API

在新的終端窗口測試：

```bash
# 健康檢查
curl http://localhost:5000/health

# 測試根端點
curl http://localhost:5000/

# 檢查資料庫遷移狀態
npm run db:status
```

## 📱 前端測試步驟

### 1. 安裝依賴
```bash
cd frontend
npm install
```

### 2. 啟動開發服務器
```bash
npm start
```

### 3. 選擇測試平台
- 按 `w` - Web 瀏覽器測試
- 按 `a` - Android 模擬器
- 按 `i` - iOS 模擬器
- 掃描 QR Code - 實體設備

## 🧪 功能測試流程

### 階段 1: 後端 API 測試

1. **健康檢查**:
   ```bash
   curl http://localhost:5000/health
   ```
   期望回應: `{"success": true, "data": {"status": "healthy"}}`

2. **Spotify 登入流程** (需要真實憑證):
   ```bash
   # 在瀏覽器打開
   http://localhost:5000/api/auth/spotify/login
   ```

3. **位置 API 測試**:
   ```bash
   curl -X POST http://localhost:5000/api/location/update \
     -H "Content-Type: application/json" \
     -d '{"lat": 25.0330, "lng": 121.5654}'
   ```

4. **地圖資料測試**:
   ```bash
   curl "http://localhost:5000/api/map/data?lat=25.0330&lng=121.5654&zoom=15"
   ```

### 階段 2: 前端應用測試

1. **啟動應用**: 確保前端成功載入

2. **Spotify 登入**: 
   - 點擊 "登入 Spotify" 按鈕
   - 完成 OAuth 授權流程
   - 檢查用戶資料是否正確顯示

3. **位置功能**:
   - 點擊 "取得位置" 按鈕
   - 允許位置權限
   - 檢查座標和 Hex ID 是否顯示

4. **音樂追蹤**:
   - 在 Spotify 開始播放音樂
   - 檢查應用是否顯示當前播放歌曲
   - 確認播放記錄被儲存

5. **地圖功能**:
   - 切換到 "Explore" 標籤
   - 檢查地圖是否顯示
   - 查看是否有音樂熱點標記

### 階段 3: 端到端測試

1. **完整使用者流程**:
   ```
   登入 Spotify → 獲取位置 → 播放音樂 → 查看地圖 → 探索音樂熱點
   ```

2. **資料一致性檢查**:
   - 播放的音樂是否出現在資料庫
   - 地圖標記是否反映真實播放資料
   - 統計數據是否正確更新

## 🐛 常見問題排除

### 資料庫連接失敗
```bash
# 檢查 PostgreSQL 是否運行
pg_isready -h localhost -p 5432

# 檢查資料庫是否存在
psql -U postgres -l | grep soundmate_ar
```

### Spotify API 錯誤
- 檢查 Client ID/Secret 是否正確
- 確認 Redirect URI 設置正確
- 檢查 Spotify 帳號是否有開發者權限

### 前端無法連接後端
- 確認後端運行在 port 5000
- 檢查防火牆設置
- 確認 API_BASE_URL 設定正確

### 位置服務失敗
- 檢查瀏覽器/設備位置權限
- 確認 HTTPS 設置 (某些瀏覽器需要)

## 📊 測試資料範例

### 成功的 API 回應格式

**位置更新**:
```json
{
  "success": true,
  "data": {
    "hex_id": "891fb466257ffff",
    "center_lat": 25.033,
    "center_lng": 121.5654,
    "resolution": 9
  }
}
```

**當前播放**:
```json
{
  "success": true,
  "data": {
    "track": {
      "name": "Song Name",
      "artist": "Artist Name",
      "album": "Album Name",
      "is_playing": true
    }
  }
}
```

## 🎯 測試成功標準

- [ ] 後端服務器成功啟動
- [ ] 資料庫遷移成功完成
- [ ] Spotify OAuth 流程正常
- [ ] 位置服務正常工作
- [ ] 播放資料成功記錄
- [ ] 地圖顯示音樂熱點
- [ ] 前後端資料同步正常

---

**需要幫助？** 遇到問題請提供錯誤日誌，我會協助您解決！