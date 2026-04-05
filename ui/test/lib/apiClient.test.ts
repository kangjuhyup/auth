import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}));

// apiClient 는 동적 import 후 사용하므로 mock 등록 후 import
const { apiClient } = await import('@/lib/apiClient');

function makeResponse(body: unknown, status = 200, ok = true): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('apiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let clearAuthMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    clearAuthMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('location', { href: '' });

    vi.mocked(useAuthStore.getState).mockReturnValue({
      token: null,
      clearAuth: clearAuthMock,
      isAuthenticated: false,
      username: null,
      login: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Authorization 헤더', () => {
    it('token 이 있으면 Bearer 헤더를 주입한다', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({
        token: 'my-token',
        clearAuth: clearAuthMock,
        isAuthenticated: true,
        username: 'user',
        login: vi.fn(),
      });
      fetchMock.mockResolvedValue(makeResponse({ data: 'ok' }));

      await apiClient.get('/test');

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['Authorization']).toBe(
        'Bearer my-token',
      );
    });

    it('token 이 null 이면 Authorization 헤더를 포함하지 않는다', async () => {
      fetchMock.mockResolvedValue(makeResponse({ data: 'ok' }));

      await apiClient.get('/test');

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(
        (init.headers as Record<string, string>)['Authorization'],
      ).toBeUndefined();
    });
  });

  describe('Query params', () => {
    it('params 를 URLSearchParams 로 변환하여 URL 에 추가한다', async () => {
      fetchMock.mockResolvedValue(makeResponse({}));

      await apiClient.get('/users', { params: { page: 1, limit: 20 } });

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('page=1');
      expect(url).toContain('limit=20');
    });

    it('null / undefined 값은 query string 에서 제외한다', async () => {
      fetchMock.mockResolvedValue(makeResponse({}));

      await apiClient.get('/users', {
        params: { page: 1, filter: null, sort: undefined },
      });

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).not.toContain('filter');
      expect(url).not.toContain('sort');
    });

    it('params 가 없으면 ? 를 붙이지 않는다', async () => {
      fetchMock.mockResolvedValue(makeResponse({}));

      await apiClient.get('/users');

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).not.toContain('?');
    });
  });

  describe('HTTP 메서드', () => {
    it('get 은 method: GET 으로 요청한다', async () => {
      fetchMock.mockResolvedValue(makeResponse({}));
      await apiClient.get('/test');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe('GET');
    });

    it('post 는 body 를 JSON 직렬화하여 전송한다', async () => {
      fetchMock.mockResolvedValue(makeResponse({}));
      await apiClient.post('/test', { name: 'alice' });
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ name: 'alice' }));
    });

    it('delete 는 body 없이 DELETE 요청한다', async () => {
      fetchMock.mockResolvedValue(makeResponse({}));
      await apiClient.delete('/test/1');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe('DELETE');
      expect(init.body).toBeUndefined();
    });
  });

  describe('에러 처리', () => {
    it('401 응답 시 clearAuth 를 호출하고 /login 으로 리다이렉트한다', async () => {
      fetchMock.mockResolvedValue(makeResponse({}, 401, false));

      await expect(apiClient.get('/secure')).rejects.toThrow(
        'Unauthorized: 401',
      );
      expect(clearAuthMock).toHaveBeenCalledOnce();
      expect(location.href).toBe('/login');
    });

    it('403 응답 시 clearAuth 를 호출하고 /login 으로 리다이렉트한다', async () => {
      fetchMock.mockResolvedValue(makeResponse({}, 403, false));

      await expect(apiClient.get('/secure')).rejects.toThrow(
        'Unauthorized: 403',
      );
      expect(clearAuthMock).toHaveBeenCalledOnce();
      expect(location.href).toBe('/login');
    });

    it('서버가 message 를 반환하면 해당 메시지로 throw 한다', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ message: 'Not found' }, 404, false),
      );

      await expect(apiClient.get('/missing')).rejects.toThrow('Not found');
    });

    it('서버 응답에 message 가 없으면 상태코드로 throw 한다', async () => {
      fetchMock.mockResolvedValue(makeResponse({}, 500, false));

      await expect(apiClient.get('/error')).rejects.toThrow('API Error: 500');
    });
  });
});
