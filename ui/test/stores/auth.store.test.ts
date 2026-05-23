import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      isAuthenticated: false,
      username: null,
    });
  });

  describe('초기 상태', () => {
    it('인증되지 않은 상태로 시작한다', () => {
      const { isAuthenticated, username } = useAuthStore.getState();
      expect(isAuthenticated).toBe(false);
      expect(username).toBeNull();
    });
  });

  describe('login()', () => {
    it('isAuthenticated, username 을 설정한다', () => {
      useAuthStore.getState().login('alice');

      const { isAuthenticated, username } = useAuthStore.getState();
      expect(isAuthenticated).toBe(true);
      expect(username).toBe('alice');
    });
  });

  describe('clearAuth()', () => {
    it('로그인 후 clearAuth() 를 호출하면 상태를 초기화한다', () => {
      useAuthStore.getState().login('alice');
      useAuthStore.getState().clearAuth();

      const { isAuthenticated, username } = useAuthStore.getState();
      expect(isAuthenticated).toBe(false);
      expect(username).toBeNull();
    });
  });

  describe('token storage', () => {
    it('login() 후 토큰을 localStorage 에 저장하지 않는다', () => {
      useAuthStore.getState().login('bob');

      expect(localStorage.getItem('auth-storage')).toBeNull();
    });

    it('clearAuth() 후에도 localStorage 에 인증 정보를 쓰지 않는다', () => {
      useAuthStore.getState().login('bob');
      useAuthStore.getState().clearAuth();

      expect(localStorage.getItem('auth-storage')).toBeNull();
    });

    it('기존 persist 저장소가 남아 있으면 모듈 로드 시 제거한다', async () => {
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            isAuthenticated: true,
            token: 'legacy-token',
            username: 'legacy-admin',
          },
        }),
      );

      vi.resetModules();
      await import('@/stores/auth.store');

      expect(localStorage.getItem('auth-storage')).toBeNull();
    });
  });
});
