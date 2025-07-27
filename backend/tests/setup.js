// 測試環境設定
require('dotenv').config({ path: '.env.test' });

// 設定測試環境變數
process.env.NODE_ENV = 'test';
process.env.PORT = 5001;
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test_user:test_pass@localhost:5432/test_db';

// 全域測試設定
beforeAll(() => {
  console.log('🧪 測試環境啟動');
});

afterAll(() => {
  console.log('✅ 測試環境關閉');
});