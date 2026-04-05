import { afterEach, vi } from 'vitest';

// zustand persist 가 사용하는 localStorage 초기화
afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
