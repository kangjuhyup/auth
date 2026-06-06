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
  passwordChangeRequired: boolean;
  login: (username: string, passwordChangeRequired?: boolean) => void;
  completePasswordChange: () => void;
  clearAuth: () => void;
}

removeLegacyAuthStorage();

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  username: null,
  passwordChangeRequired: false,
  login: (username, passwordChangeRequired = false) =>
    set({ isAuthenticated: true, username, passwordChangeRequired }),
  completePasswordChange: () => set({ passwordChangeRequired: false }),
  clearAuth: () =>
    set({
      isAuthenticated: false,
      username: null,
      passwordChangeRequired: false,
    }),
}));
