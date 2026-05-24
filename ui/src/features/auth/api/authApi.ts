import { apiClient } from '@/lib/apiClient';
import { mockApi } from '@/lib/mockApi';
import type {
  IdentityLinkResponse,
  LoginDto,
  LoginResponse,
  ProfileResponse,
  StartIdentityLinkResponse,
  TotpConfirmationResponse,
  TotpEnrollmentResponse,
} from '@/types/auth.types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

const tenantOptions = (tenantCode: string) => ({
  headers: { 'x-tenant-code': tenantCode },
});

export const authApi = {
  login: (dto: LoginDto): Promise<LoginResponse> => {
    if (USE_MOCK) return mockApi.auth.login(dto);
    return apiClient.post<LoginResponse>('/admin/session', dto);
  },

  getSession: (): Promise<LoginResponse> => {
    if (USE_MOCK) return mockApi.auth.getSession();
    return apiClient.get<LoginResponse>('/admin/session');
  },

  logout: (): Promise<void> => {
    if (USE_MOCK) return mockApi.auth.logout();
    return apiClient.delete<void>('/admin/session').catch(() => {});
  },

  getProfile: (tenantCode: string): Promise<ProfileResponse> => {
    if (USE_MOCK) return mockApi.auth.getProfile(tenantCode);
    return apiClient.get<ProfileResponse>(
      '/auth/profile',
      tenantOptions(tenantCode),
    );
  },

  requestEmailVerification: (tenantCode: string): Promise<void> => {
    if (USE_MOCK) return mockApi.auth.requestEmailVerification(tenantCode);
    return apiClient.post<void>(
      '/auth/email/verification-request',
      undefined,
      tenantOptions(tenantCode),
    );
  },

  verifyEmail: (tenantCode: string, token: string): Promise<void> => {
    if (USE_MOCK) return mockApi.auth.verifyEmail(tenantCode, token);
    return apiClient.post<void>(
      '/auth/email/verify',
      { token },
      tenantOptions(tenantCode),
    );
  },

  requestPhoneVerification: (tenantCode: string): Promise<void> => {
    if (USE_MOCK) return mockApi.auth.requestPhoneVerification(tenantCode);
    return apiClient.post<void>(
      '/auth/phone/verification-request',
      undefined,
      tenantOptions(tenantCode),
    );
  },

  verifyPhone: (tenantCode: string, token: string): Promise<void> => {
    if (USE_MOCK) return mockApi.auth.verifyPhone(tenantCode, token);
    return apiClient.post<void>(
      '/auth/phone/verify',
      { token },
      tenantOptions(tenantCode),
    );
  },

  beginTotpEnrollment: (
    tenantCode: string,
  ): Promise<TotpEnrollmentResponse> => {
    if (USE_MOCK) return mockApi.auth.beginTotpEnrollment(tenantCode);
    return apiClient.post<TotpEnrollmentResponse>(
      '/auth/mfa/totp/enroll',
      undefined,
      tenantOptions(tenantCode),
    );
  },

  confirmTotpEnrollment: (
    tenantCode: string,
    code: string,
  ): Promise<TotpConfirmationResponse> => {
    if (USE_MOCK) return mockApi.auth.confirmTotpEnrollment(tenantCode, code);
    return apiClient.post<TotpConfirmationResponse>(
      '/auth/mfa/totp/confirm',
      { code },
      tenantOptions(tenantCode),
    );
  },

  disableTotp: (tenantCode: string): Promise<void> => {
    if (USE_MOCK) return mockApi.auth.disableTotp(tenantCode);
    return apiClient.delete<void>('/auth/mfa/totp', tenantOptions(tenantCode));
  },

  updateMfaPreference: (
    tenantCode: string,
    enabled: boolean,
  ): Promise<void> => {
    if (USE_MOCK) return mockApi.auth.updateMfaPreference(tenantCode, enabled);
    return apiClient.put<void>(
      '/auth/mfa/preference',
      { enabled },
      tenantOptions(tenantCode),
    );
  },

  getIdentityLinks: (tenantCode: string): Promise<IdentityLinkResponse[]> => {
    if (USE_MOCK) return mockApi.auth.getIdentityLinks(tenantCode);
    return apiClient.get<IdentityLinkResponse[]>(
      '/auth/identity-links',
      tenantOptions(tenantCode),
    );
  },

  startIdentityLink: (
    tenantCode: string,
    provider: string,
    returnTo: string,
  ): Promise<StartIdentityLinkResponse> => {
    if (USE_MOCK) {
      return mockApi.auth.startIdentityLink(tenantCode, provider, returnTo);
    }
    return apiClient.post<StartIdentityLinkResponse>(
      `/auth/identity-links/${provider}/start`,
      { returnTo },
      tenantOptions(tenantCode),
    );
  },

  unlinkIdentity: (tenantCode: string, identityId: string): Promise<void> => {
    if (USE_MOCK) return mockApi.auth.unlinkIdentity(tenantCode, identityId);
    return apiClient.delete<void>(
      `/auth/identity-links/${identityId}`,
      tenantOptions(tenantCode),
    );
  },
};
