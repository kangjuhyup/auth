import { create } from 'zustand';

const LEGACY_AUTH_STORAGE_KEY = 'auth-storage';

const removeLegacyAuthStorage = () => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  } catch {
    // Ignore storage access errors; auth state remains memory-only.
  }
};

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string) => void;
  clearAuth: () => void;
}

removeLegacyAuthStorage();

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  username: null,
  login: (username) => set({ isAuthenticated: true, username }),
  clearAuth: () => set({ isAuthenticated: false, username: null }),
}));
