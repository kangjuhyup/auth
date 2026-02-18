import { mockApi } from '@/lib/mockApi';
import type { LoginDto, LoginResponse } from '@/types/auth.types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

export const authApi = {
  login: (dto: LoginDto): Promise<LoginResponse> => {
    if (USE_MOCK) return mockApi.auth.login(dto);
    // Real API call would go here
    throw new Error('Real API not implemented');
  },

  logout: (): Promise<void> => {
    if (USE_MOCK) return mockApi.auth.logout();
    // Real API call would go here
    throw new Error('Real API not implemented');
  },
};
