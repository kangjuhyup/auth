import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/mockApi', () => ({
  mockApi: {
    users: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getRoles: vi.fn(),
      getSessions: vi.fn(),
      revokeSession: vi.fn(),
      revokeSessions: vi.fn(),
      getConsents: vi.fn(),
      getConsentHistory: vi.fn(),
      addRole: vi.fn(),
      removeRole: vi.fn(),
    },
  },
}));

const { apiClient } = await import('@/lib/apiClient');
const { userApi } = await import('@/features/users/api/userApi');

describe('userApi', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.delete).mockReset();
  });

  it('사용자 목록 조회 시 검색어를 포함한 query params를 전달한다', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    });

    await userApi.list('acme', {
      page: 1,
      limit: 10,
      search: 'alice',
    });

    expect(apiClient.get).toHaveBeenCalledWith('/t/acme/admin/users', {
      params: {
        page: 1,
        limit: 10,
        search: 'alice',
      },
    });
  });

  it('사용자 세션 목록 API를 호출한다', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([]);

    await userApi.getSessions('acme', 'user-1');

    expect(apiClient.get).toHaveBeenCalledWith(
      '/t/acme/admin/users/user-1/sessions',
    );
  });

  it('사용자 단일 세션 revoke API를 호출한다', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined);

    await userApi.revokeSession('acme', 'user-1', 'session-1');

    expect(apiClient.delete).toHaveBeenCalledWith(
      '/t/acme/admin/users/user-1/sessions/session-1',
    );
  });

  it('사용자 전체 세션 revoke API를 호출한다', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined);

    await userApi.revokeSessions('acme', 'user-1');

    expect(apiClient.delete).toHaveBeenCalledWith(
      '/t/acme/admin/users/user-1/sessions',
    );
  });
});
