# 🗃️ SoundMate AR 本地資料庫設置指南

本指南將協助您設置 SoundMate AR 的本地 PostgreSQL 資料庫。

## 📋 系統需求

- Windows 10/11
- Node.js (已安裝)
- 管理員權限（安裝 PostgreSQL 時需要）

## 🚀 快速設置

### 方法一：自動設置腳本（推薦）

1. **以管理員身份打開 PowerShell**
   ```powershell
   # 右鍵點擊 PowerShell 圖標 → "以管理員身份執行"
   ```

2. **執行設置腳本**
   ```powershell
   cd "C:\Users\user\Documents\Visual Studio Code"
   .\setup-postgresql.ps1
   ```

3. **按照腳本提示操作**
   - 腳本會自動安裝 Chocolatey（如果未安裝）
   - 自動安裝 PostgreSQL 15
   - 設置並啟動 PostgreSQL 服務
   - 創建 SoundMate AR 資料庫和測試數據

### 方法二：手動設置

#### 步驟 1：安裝 PostgreSQL

1. **下載 PostgreSQL**
   - 前往 [PostgreSQL 官網](https://www.postgresql.org/download/windows/)
   - 下載 PostgreSQL 15.x for Windows

2. **安裝 PostgreSQL**
   - 執行安裝程序
   - 設置 postgres 用戶密碼為 `postgres`
   - 記住端口號（預設 5432）

3. **驗證安裝**
   ```cmd
   psql -U postgres -d postgres
   # 輸入密碼: postgres
   ```

#### 步驟 2：設置專案資料庫

1. **進入後端目錄**
   ```cmd
   cd "C:\Users\user\Documents\Visual Studio Code\backend"
   ```

2. **安裝依賴**
   ```cmd
   npm install
   ```

3. **檢查環境配置**
   ```cmd
   # 確認 .env 檔案中的資料庫配置
   type .env
   ```

4. **執行資料庫設置**
   ```cmd
   node scripts/setup-database.js
   ```

## 🔧 配置說明

### 環境變數配置 (.env)

```env
# 資料庫配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=soundmate_ar
DB_USER=postgres
DB_PASSWORD=postgres

# 測試資料庫
DB_TEST_NAME=soundmate_ar_test
```

### 資料庫結構

設置腳本會創建以下資料庫：

1. **主資料庫**: `soundmate_ar`
   - 包含所有表格和測試數據
   - 用於開發和測試

2. **測試資料庫**: `soundmate_ar_test`
   - 用於單元測試
   - 結構相同但無測試數據

## 📊 資料庫表格說明

| 表格名稱 | 說明 |
|---------|------|
| `users` | 用戶資料 |
| `tracks` | 歌曲資料 |
| `user_playback` | 播放記錄 |
| `hex_properties` | H3 六邊形區域屬性 |
| `hex_top_tracks` | 各區域熱門歌曲 |
| `user_sessions` | 用戶會話記錄 |

## 🎵 測試數據

設置腳本會自動生成：

- **2 個測試用戶**
  - 測試用戶1 (台北信義區)
  - 測試用戶2 (台北信義區)

- **3 首測試歌曲**
  - As It Was - Harry Styles
  - Anti-Hero - Taylor Swift
  - Flowers - Miley Cyrus

- **50 筆播放記錄**
  - 隨機分佈在台北市區域
  - 包含音樂特徵和位置資訊

## ✅ 驗證設置

### 1. 檢查資料庫連線

```cmd
cd backend
node -e "
const { testConnection } = require('./config/database');
testConnection().then(() => console.log('✅ 連線成功')).catch(console.error);
"
```

### 2. 查看測試數據

```sql
-- 連接到資料庫
psql -U postgres -d soundmate_ar

-- 查看用戶數量
SELECT COUNT(*) FROM users;

-- 查看播放記錄
SELECT track_name, artist_name, COUNT(*) as play_count 
FROM user_playback 
GROUP BY track_name, artist_name 
ORDER BY play_count DESC;

-- 查看 Hex 區域
SELECT hex_id, total_plays, unique_users 
FROM hex_properties 
WHERE total_plays > 0;
```

### 3. 啟動應用程序

```cmd
cd backend
npm run dev
```

應用程序啟動後，您可以在 `http://localhost:5000` 訪問 API。

## 🛠️ 常見問題

### Q: PostgreSQL 安裝失敗
**A**: 確保以管理員身份執行安裝，並檢查防毒軟體是否阻擋安裝。

### Q: 資料庫連線失敗
**A**: 檢查：
- PostgreSQL 服務是否啟動
- 密碼是否正確（預設：postgres）
- 端口是否被佔用（預設：5432）

### Q: 遷移執行失敗
**A**: 檢查：
- 資料庫用戶權限
- PostgreSQL 版本（建議 13+）
- .env 檔案配置

### Q: 如何重置資料庫
```cmd
cd backend
node scripts/setup-database.js --reset
```

## 🔄 更新資料庫

當有新的遷移時：

```cmd
cd backend
node scripts/migrate.js up
```

## 🧪 執行測試

```cmd
cd backend
npm test
```

## 📱 前端設置

資料庫設置完成後，也需要設置前端：

```cmd
cd frontend
npm install
npm start
```

## 📞 支援

如果遇到問題：

1. 檢查 `backend/logs/` 中的日誌檔案
2. 確認所有環境變數正確設置
3. 驗證 PostgreSQL 服務狀態

---

設置完成後，您就可以開始開發和測試 SoundMate AR 了！🎉