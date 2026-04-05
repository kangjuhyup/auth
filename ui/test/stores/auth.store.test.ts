import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: false,
      token: null,
      username: null,
    });
  });

  describe('초기 상태', () => {
    it('인증되지 않은 상태로 시작한다', () => {
      const { isAuthenticated, token, username } = useAuthStore.getState();
      expect(isAuthenticated).toBe(false);
      expect(token).toBeNull();
      expect(username).toBeNull();
    });
  });

  describe('login()', () => {
    it('isAuthenticated, token, username 을 설정한다', () => {
      useAuthStore.getState().login('alice', 'token-abc');

      const { isAuthenticated, token, username } = useAuthStore.getState();
      expect(isAuthenticated).toBe(true);
      expect(token).toBe('token-abc');
      expect(username).toBe('alice');
    });
  });

  describe('clearAuth()', () => {
    it('로그인 후 clearAuth() 를 호출하면 상태를 초기화한다', () => {
      useAuthStore.getState().login('alice', 'token-abc');
      useAuthStore.getState().clearAuth();

      const { isAuthenticated, token, username } = useAuthStore.getState();
      expect(isAuthenticated).toBe(false);
      expect(token).toBeNull();
      expect(username).toBeNull();
    });
  });

  describe('localStorage persist', () => {
    it('login() 후 localStorage 에 인증 정보가 저장된다', () => {
      useAuthStore.getState().login('bob', 'token-xyz');

      const stored = JSON.parse(
        localStorage.getItem('auth-storage') ?? '{}',
      ) as {
        state: { isAuthenticated: boolean; token: string; username: string };
      };
      expect(stored.state.isAuthenticated).toBe(true);
      expect(stored.state.token).toBe('token-xyz');
      expect(stored.state.username).toBe('bob');
    });

    it('clearAuth() 후 localStorage 의 인증 정보가 초기화된다', () => {
      useAuthStore.getState().login('bob', 'token-xyz');
      useAuthStore.getState().clearAuth();

      const stored = JSON.parse(
        localStorage.getItem('auth-storage') ?? '{}',
      ) as {
        state: {
          isAuthenticated: boolean;
          token: string | null;
          username: string | null;
        };
      };
      expect(stored.state.isAuthenticated).toBe(false);
      expect(stored.state.token).toBeNull();
      expect(stored.state.username).toBeNull();
    });
  });
});
