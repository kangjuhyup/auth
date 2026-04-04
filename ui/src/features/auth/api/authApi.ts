import { apiClient } from '@/lib/apiClient';
import { mockApi } from '@/lib/mockApi';
import type { LoginDto, LoginResponse } from '@/types/auth.types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

export const authApi = {
  login: (dto: LoginDto): Promise<LoginResponse> => {
    if (USE_MOCK) return mockApi.auth.login(dto);
    return apiClient.post<LoginResponse>('/admin/session', dto);
  },

  logout: (): Promise<void> => {
    if (USE_MOCK) return mockApi.auth.logout();
    return apiClient.delete<void>('/admin/session').catch(() => {});
  },
};
