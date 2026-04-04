import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
  login: (username: string, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      token: null,
      username: null,
      login: (username, token) =>
        set({ isAuthenticated: true, username, token }),
      clearAuth: () =>
        set({ isAuthenticated: false, username: null, token: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        token: state.token,
        username: state.username,
      }),
    },
  ),
);
