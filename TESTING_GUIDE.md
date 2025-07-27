# 🧪 SoundMate AR 測試指南

## 📋 測試前置條件檢查清單

### 1. 環境設定
- [ ] PostgreSQL 資料庫已安裝並運行
- [ ] Node.js 和 npm 已安裝
- [ ] Expo CLI 已安裝 (`npm install -g @expo/cli`)
- [ ] 後端 `.env` 檔案已設定

### 2. 資料庫設定
```bash
# 確認 PostgreSQL 運行
pg_isready

# 檢查資料庫遷移狀態
cd backend && npm run db:status

# 如果需要，執行遷移
npm run migrate
```

### 3. 依賴安裝
```bash
# 後端依賴
cd backend && npm install

# 前端依賴  
cd ../frontend && npm install --legacy-peer-deps
```

## 🚀 測試步驟

### 第一步：後端服務測試

1. **啟動後端服務**
```bash
cd backend
npm run dev
```

2. **驗證基本 API**
```bash
# 健康檢查
curl http://localhost:5000/health

# 根端點
curl http://localhost:5000/
```

3. **測試地圖 API (使用模擬邊界)**
```bash
# 測試六邊形查詢
curl "http://localhost:5000/api/map/hexagons?north=25.04&south=25.02&east=121.58&west=121.55"
```

### 第二步：音樂特徵服務測試

```bash
# 在 backend 目錄執行
npm test -- --testPathPatterns=musicFeatures
```

**預期結果：** 14 個測試全部通過

### 第三步：前端應用測試

1. **啟動前端應用**
```bash
cd frontend
npm start
```

2. **選擇測試平台**
   - Web: 按 `w` 開啟瀏覽器版本
   - iOS 模擬器: 按 `i` (需要 Xcode)
   - Android 模擬器: 按 `a` (需要 Android Studio)

### 第四步：地圖視覺化功能測試

1. **開啟探索頁面**
   - 導航到 "Explore" 標籤
   - 確認地圖正確載入

2. **測試位置權限**
   - 允許位置權限
   - 確認地圖定位到當前位置

3. **測試六邊形顯示**
   - 觀察地圖上的彩色六邊形
   - 應該看到 15 個測試六邊形（模擬資料）

4. **測試互動功能**
   - 點擊任意六邊形
   - 確認彈出 Modal 顯示音樂資訊
   - 檢查統計數據和歌曲列表

## 🔍 詳細測試案例

### A. 音樂特徵色彩映射測試

**測試目標：** 驗證音樂特徵正確轉換為顏色

```javascript
// 在瀏覽器開發者工具中執行
const testFeatures = {
  energy: 0.8,    // 高能量
  valence: 0.7,   // 快樂
  danceability: 0.9,  // 可舞蹈
  acousticness: 0.1   // 電子
};

console.log('應該產生紅色系色彩');
```

**預期結果：** 高能量歌曲產生紅/橘色系色彩

### B. 地圖效能測試

**測試目標：** 確認地圖渲染效能

1. 開啟瀏覽器開發者工具 > Console
2. 查看效能日誌：
   - `⚡ 地圖渲染: XXms (15 個六邊形)`
   - 渲染時間應 < 100ms

3. 測試地圖操作：
   - 縮放地圖
   - 拖拽地圖
   - 觀察效能指標

### C. API 整合測試

**測試目標：** 驗證前後端資料流

1. **模擬播放記錄** (需要有效的 Spotify token)
```bash
curl -X POST http://localhost:5000/api/music/playback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SPOTIFY_TOKEN" \
  -d '{
    "track_data": {
      "spotify_track_id": "test_track_123",
      "name": "測試歌曲",
      "artist": "測試藝人",
      "album": "測試專輯",
      "duration_ms": 180000,
      "is_playing": true,
      "progress_ms": 30000
    },
    "location": {
      "lat": 25.0330,
      "lng": 121.5654
    },
    "hex_id": "891f1d4a5afffff"
  }'
```

2. **檢查聚合服務**
   - 查看伺服器日誌中的聚合更新訊息
   - 確認 hex 顏色計算正確

## ⚠️ 常見問題與解決方案

### 問題 1: 資料庫連線失敗
```
error: password authentication failed for user "postgres"
```
**解決方案：**
1. 檢查 PostgreSQL 是否運行
2. 確認 `.env` 中的資料庫連線設定
3. 檢查資料庫用戶權限

### 問題 2: 前端依賴安裝失敗
```
ERESOLVE unable to resolve dependency tree
```
**解決方案：**
```bash
npm install --legacy-peer-deps --force
```

### 問題 3: 地圖不顯示六邊形
**檢查項目：**
1. 後端服務是否運行 (localhost:5000)
2. 位置權限是否允許
3. 瀏覽器 Console 是否有錯誤訊息

### 問題 4: H3 計算錯誤
**檢查項目：**
1. `h3-js` 套件是否正確安裝
2. 位置座標是否有效
3. 查看錯誤日誌以確定問題

## 📊 測試完成標準

### ✅ 後端測試通過標準
- [ ] 健康檢查 API 回應正常
- [ ] 地圖 API 回傳正確資料結構
- [ ] 音樂特徵服務測試全部通過
- [ ] 聚合服務正常啟動和運行
- [ ] 無記憶體洩漏或效能問題

### ✅ 前端測試通過標準  
- [ ] 地圖正確載入和顯示
- [ ] 六邊形正確渲染 (模擬或真實資料)
- [ ] 點擊互動功能正常
- [ ] 位置權限和定位功能正常
- [ ] 效能指標在可接受範圍內

### ✅ 整合測試通過標準
- [ ] 前後端資料正確傳遞
- [ ] 音樂特徵→色彩映射正確
- [ ] Hex 聚合統計功能正常
- [ ] 錯誤處理和回退機制有效

## 🎯 測試建議

1. **逐步測試：** 先測試後端，再測試前端，最後測試整合
2. **日誌監控：** 隨時查看 Console 和伺服器日誌
3. **效能關注：** 注意渲染時間和記憶體使用
4. **邊界測試：** 測試極端情況和錯誤處理

---

**準備好開始測試了嗎？** 🚀

按照上述步驟，您就能全面驗證 SoundMate AR 地圖視覺化系統的功能！