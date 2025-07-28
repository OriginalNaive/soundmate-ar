// 測試環境設定
require('dotenv').config({ path: '.env.test' });

// 設定測試環境變數
process.env.NODE_ENV = 'test';
process.env.PORT = 5001;

// 模擬資料庫連線 - 避免真實資料庫連線問題
process.env.MOCK_DATABASE = 'true';

// 全域測試設定
beforeAll(() => {
  console.log('🧪 測試環境啟動');
});

afterAll(() => {
  console.log('✅ 測試環境關閉');
});