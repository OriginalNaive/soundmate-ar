# SoundMate AR - 音樂地圖探索應用

基於位置的音樂發現與社交平台，使用 React Native + Node.js + PostgreSQL + Spotify API 開發。

## 🌟 功能特色

- **Spotify 整合**: 自動獲取並記錄用戶的播放資料
- **位置服務**: 使用 H3 六角形網格系統聚合地理位置
- **音樂地圖**: 在地圖上探索附近的音樂活動熱點
- **即時更新**: 自動同步播放狀態和位置資訊

## 🛠 技術架構

### 後端 (Node.js + Express)
- **身份驗證**: Spotify OAuth 2.0
- **資料庫**: PostgreSQL 儲存用戶、歌曲、播放記錄
- **位置處理**: H3.js 六角形網格聚合
- **API**: RESTful 設計，支援即時資料查詢

### 前端 (React Native + Expo)
- **跨平台**: iOS、Android、Web 支援
- **地圖整合**: React Native Maps 顯示音樂熱點
- **狀態管理**: AsyncStorage 本地快取
- **使用者介面**: 響應式設計，支援淺色/深色模式

## 📱 MVP 功能

### Phase 1: 核心基礎 ✅
- [x] Spotify OAuth 登入與 token 管理
- [x] PostgreSQL 資料庫 schema 建立
- [x] H3 位置聚合系統
- [x] 基礎 API 端點
- [x] 完整的資料庫 Models 層

### Phase 2: 核心功能 ✅
- [x] 當前播放歌曲獲取
- [x] 播放記錄儲存
- [x] 地圖基礎渲染
- [x] Hex 聚合運算邏輯
- [x] 前端 OAuth 流程優化

### Phase 3: 使用者體驗 (部分完成)
- [x] 地圖 UI/UX 基礎
- [x] 歌曲詳情 API
- [x] Token 自動刷新機制
- [ ] 效能優化與快取

## 🚀 快速開始

### 後端設置

1. **安裝依賴**
```bash
cd backend
npm install
```

2. **環境配置**
```bash
cp .env.example .env
# 編輯 .env 檔案，填入 Spotify API 憑證和資料庫配置
```

3. **資料庫遷移**
```bash
npm run migrate
```

4. **啟動伺服器**
```bash
npm run dev
```

### 前端設置

1. **安裝依賴**
```bash
cd frontend
npm install
```

2. **啟動應用**
```bash
# iOS
npm run ios

# Android
npm run android

# Web
npm run web
```

## 📊 資料庫結構

### 核心表格
- `users`: 用戶資料與 Spotify 憑證
- `tracks`: 歌曲資訊
- `user_playback`: 播放記錄與位置
- `hex_properties`: H3 六角形區域屬性
- `hex_top_tracks`: 每個區域的熱門歌曲

### 重要索引
- 位置查詢: `(latitude, longitude)`
- 時間範圍: `(played_at)`
- Hex 聚合: `(hex_id, rank_score)`

## 🔧 API 端點

### 身份驗證
- `GET /api/auth/spotify/login` - Spotify 登入
- `POST /api/auth/spotify/refresh` - 刷新 token
- `GET /api/auth/spotify/me` - 獲取用戶資訊

### 音樂
- `GET /api/music/current` - 當前播放歌曲
- `POST /api/music/playback` - 記錄播放資料
- `GET /api/music/history` - 播放歷史

### 位置與地圖
- `POST /api/location/update` - 更新位置
- `GET /api/location/hex/:hex_id` - 獲取 Hex 資料
- `GET /api/map/data` - 地圖資料查詢

## 🎯 下一步開發

### 即將推出
1. **資料庫操作完善**: 完整的 CRUD 操作
2. **Hex 聚合算法**: 即時統計和排名計算
3. **歌曲詳情頁**: 歌曲資訊與播放統計
4. **OAuth 完善**: 前端 OAuth 流程優化

### 未來規劃
- **即時通知**: 附近音樂活動提醒
- **社交功能**: 用戶互動與音樂分享
- **AR 視覺化**: 3D 音樂標籤和效果
- **推薦系統**: 個人化音樂推薦

## 📝 開發筆記

### H3 六角形網格
- 使用 Resolution 9 (邊長約 174m)
- 適合城市規模的音樂活動聚合
- 支援多層級縮放和鄰近查詢

### 效能考量
- 使用資料庫索引優化查詢
- API 回應格式統一，便於快取
- 前端狀態管理減少重複請求

### 安全性
- Spotify token 安全儲存
- API 請求驗證
- 敏感資料加密

## 🤝 貢獻指南

1. Fork 專案
2. 創建功能分支 (`git checkout -b feature/新功能`)
3. 提交變更 (`git commit -m '新增: 某某功能'`)
4. 推送分支 (`git push origin feature/新功能`)
5. 創建 Pull Request

## 📄 授權

MIT License - 詳見 [LICENSE](LICENSE) 檔案

## 🐛 問題回報

如遇到問題，請到 [Issues](https://github.com/your-repo/soundmate-ar/issues) 頁面回報。

---

**SoundMate AR Team** - 讓音樂連結世界 🎵🌍