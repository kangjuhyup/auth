import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
  login: (username: string, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  token: null,
  username: null,
  login: (username, token) =>
    set({ isAuthenticated: true, username, token }),
  clearAuth: () => set({ isAuthenticated: false, username: null, token: null }),
}));
