# Spotify API 設定指南

## 🎵 獲取 Spotify API 憑證

要使用 SoundMate AR，您需要先申請 Spotify 開發者帳號並創建應用程式。

### 步驟 1: 創建 Spotify 開發者帳號

1. 前往 [Spotify for Developers](https://developer.spotify.com/)
2. 點擊右上角的 **Log in** 
3. 使用您的 Spotify 帳號登入 (如果沒有，請先註冊)
4. 前往 [Dashboard](https://developer.spotify.com/dashboard)

### 步驟 2: 創建新應用程式

1. 在 Dashboard 中點擊 **Create app**
2. 填寫應用程式資訊：
   - **App name**: `SoundMate AR`
   - **App description**: `Location-based music discovery application`
   - **Website**: 可以填寫 `http://localhost:3000` (開發用)
   - **Redirect URI**: `http://localhost:5000/api/auth/spotify/callback`
3. 勾選服務條款同意框
4. 點擊 **Save**

### 步驟 3: 獲取 API 憑證

1. 創建應用後，您會進入應用設定頁面
2. 記下以下資訊：
   - **Client ID**: 在頁面頂部顯示
   - **Client Secret**: 點擊 "Show client secret" 顯示

### 步驟 4: 設定環境變數

1. 複製 `.env.example` 為 `.env`:
```bash
cd backend
cp .env.example .env
```

2. 編輯 `.env` 檔案，填入您的 Spotify 憑證:
```bash
# Spotify API Configuration
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:5000/api/auth/spotify/callback
```

### 步驟 5: 設定資料庫

如果您還沒有 PostgreSQL 資料庫：

1. **安裝 PostgreSQL**
   - macOS: `brew install postgresql`
   - Ubuntu: `sudo apt-get install postgresql postgresql-contrib`
   - Windows: 下載並安裝 [PostgreSQL](https://www.postgresql.org/download/windows/)

2. **創建資料庫**
```sql
-- 以 postgres 用戶身份登入
sudo -u postgres psql

-- 創建資料庫
CREATE DATABASE soundmate_ar;

-- 創建用戶 (可選)
CREATE USER soundmate_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE soundmate_ar TO soundmate_user;
```

3. **更新 .env 資料庫設定**
```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=soundmate_ar
DB_USER=postgres  # 或您創建的用戶
DB_PASSWORD=your_password
```

### 步驟 6: 初始化應用

1. **安裝後端依賴**
```bash
cd backend
npm install
```

2. **執行資料庫遷移**
```bash
npm run migrate
```

3. **啟動後端伺服器**
```bash
npm run dev
```

4. **安裝前端依賴** (新終端窗口)
```bash
cd frontend
npm install
```

5. **啟動前端應用**
```bash
npm start
```

## 🔧 測試設定

### 測試後端 API

1. 檢查服務器狀態:
```bash
curl http://localhost:5000/health
```

2. 測試 Spotify 登入 (在瀏覽器中打開):
```
http://localhost:5000/api/auth/spotify/login
```

### 常見問題

#### 1. "Invalid client" 錯誤
- 檢查 `SPOTIFY_CLIENT_ID` 和 `SPOTIFY_CLIENT_SECRET` 是否正確
- 確認沒有多餘的空格或引號

#### 2. "Invalid redirect URI" 錯誤
- 確認 Spotify 應用設定中的 Redirect URI 為: `http://localhost:5000/api/auth/spotify/callback`
- 檢查 `.env` 中的 `SPOTIFY_REDIRECT_URI` 是否一致

#### 3. 資料庫連接失敗
- 確認 PostgreSQL 服務正在運行
- 檢查資料庫憑證是否正確
- 確認資料庫已存在

#### 4. "Permission denied" 錯誤
- 確認資料庫用戶有足夠權限
- 檢查防火牆設定

## 📱 前端測試

1. 打開應用: `http://localhost:8081` (或 Expo 提供的 URL)
2. 點擊 "登入 Spotify"
3. 完成 OAuth 授權流程
4. 允許位置權限
5. 開始播放 Spotify 音樂
6. 檢查是否有播放記錄

## 🎯 生產環境設定

### Spotify 應用設定

1. 在 Spotify Dashboard 中更新 Redirect URI:
```
https://your-domain.com/api/auth/spotify/callback
```

2. 更新生產環境變數:
```bash
SPOTIFY_REDIRECT_URI=https://your-domain.com/api/auth/spotify/callback
NODE_ENV=production
```

### 安全注意事項

- **不要** 將 `.env` 檔案提交到版本控制
- 在生產環境中使用環境變數而非 `.env` 檔案
- 定期輪換 API 憑證
- 使用 HTTPS 確保資料傳輸安全

## 📊 API 限制

Spotify API 有以下限制：
- **Rate Limit**: 每秒最多 100 個請求
- **User Authorization**: 每個用戶需要單獨授權
- **Scopes**: 需要適當的權限範圍

我們的應用使用的 Scopes:
- `user-read-currently-playing`: 讀取當前播放
- `user-read-playback-state`: 讀取播放狀態
- `user-read-email`: 獲取用戶 email
- `user-read-private`: 獲取用戶基本資料

## 🚀 部署建議

### 後端部署
- 使用 PM2 或類似工具管理 Node.js 進程
- 設定 Nginx 反向代理
- 配置 SSL 證書

### 前端部署
- 使用 Expo EAS Build 建構應用
- 發布到 App Store 和 Google Play
- 配置推送通知服務

---

**需要幫助？** 查看 [Spotify Web API 文檔](https://developer.spotify.com/documentation/web-api/) 或在專案 Issues 中提問。