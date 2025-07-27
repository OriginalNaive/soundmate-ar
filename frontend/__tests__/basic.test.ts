describe('🧪 基本前端測試設定', () => {
  it('測試環境應該正常運作', () => {
    expect(1 + 1).toBe(2);
  });

  it('應該能夠處理 TypeScript', () => {
    const message: string = 'Hello, TypeScript!';
    expect(typeof message).toBe('string');
    expect(message).toContain('TypeScript');
  });

  it('應該能夠測試 async/await', async () => {
    const asyncFunction = () => Promise.resolve('success');
    const result = await asyncFunction();
    expect(result).toBe('success');
  });
});