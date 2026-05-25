import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '@/features/auth/api/authApi';
import { message } from 'antd';

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}));

vi.mock('@/features/auth/api/authApi', () => ({
  authApi: {
    refreshSession: vi.fn(),
  },
}));

vi.mock('antd', () => ({
  message: {
    error: vi.fn(),
  },
}));

const { apiClient } = await import('@/lib/apiClient');

function makeResponse(body: unknown, status = 200, ok = true): Response {
  const text = body === undefined || body === null ? '' : JSON.stringify(body);

  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(text),
  } as unknown as Response;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('apiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let clearAuthMock: ReturnType<typeof vi.fn>;
  let loginMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    clearAuthMock = vi.fn();
    loginMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('location', { href: '' });
    vi.mocked(message.error).mockClear();
    vi.mocked(authApi.refreshSession).mockReset();

    vi.mocked(useAuthStore.getState).mockReturnValue({
      clearAuth: clearAuthMock,
      isAuthenticated: false,
      username: null,
      passwordChangeRequired: false,
      login: loginMock,
      completePasswordChange: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Cookie credentials', () => {
    it('기본 요청은 HttpOnly cookie 전송을 위해 credentials: include를 사용한다', async () => {
      fetchMock.mockResolvedValue(makeResponse({ data: 'ok' }));

      await apiClient.get('/test');

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.credentials).toBe('include');
    });

    it('Authorization 헤더를 자동으로 포함하지 않는다', async () => {
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

    it('200 OK 이지만 body가 비어 있는 응답을 성공으로 처리한다', async () => {
      fetchMock.mockResolvedValue(makeResponse(undefined, 200, true));

      await expect(apiClient.delete('/test/1')).resolves.toBeUndefined();
    });

    it('204 No Content 응답을 성공으로 처리한다', async () => {
      fetchMock.mockResolvedValue(makeResponse(undefined, 204, true));

      await expect(apiClient.delete('/test/1')).resolves.toBeUndefined();
    });
  });

  describe('에러 처리', () => {
    it('401 응답이면 refresh 성공 후 원래 요청을 한 번 재시도한다', async () => {
      fetchMock
        .mockResolvedValueOnce(makeResponse({}, 401, false))
        .mockResolvedValueOnce(makeResponse({ data: 'ok' }));
      vi.mocked(authApi.refreshSession).mockResolvedValue({
        username: 'admin',
        passwordChangeRequired: false,
      });

      await expect(apiClient.get<{ data: string }>('/secure')).resolves.toEqual(
        { data: 'ok' },
      );

      expect(authApi.refreshSession).toHaveBeenCalledTimes(1);
      expect(loginMock).toHaveBeenCalledWith('admin', false);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(clearAuthMock).not.toHaveBeenCalled();
      expect(location.href).toBe('');
    });

    it('동시에 401이 발생해도 refresh는 한 번만 수행한다', async () => {
      const refreshDeferred = createDeferred<{
        username: string;
        passwordChangeRequired: boolean;
      }>();

      fetchMock
        .mockResolvedValueOnce(makeResponse({}, 401, false))
        .mockResolvedValueOnce(makeResponse({}, 401, false))
        .mockResolvedValueOnce(makeResponse({ id: 1 }))
        .mockResolvedValueOnce(makeResponse({ id: 2 }));
      vi.mocked(authApi.refreshSession).mockReturnValue(
        refreshDeferred.promise,
      );

      const first = apiClient.get<{ id: number }>('/secure/1');
      const second = apiClient.get<{ id: number }>('/secure/2');

      await vi.waitFor(() => {
        expect(authApi.refreshSession).toHaveBeenCalledTimes(1);
      });

      refreshDeferred.resolve({
        username: 'admin',
        passwordChangeRequired: false,
      });

      await expect(Promise.all([first, second])).resolves.toEqual([
        { id: 1 },
        { id: 2 },
      ]);
      expect(authApi.refreshSession).toHaveBeenCalledTimes(1);
    });

    it('refresh도 실패하면 clearAuth 를 호출하고 /login 으로 리다이렉트한다', async () => {
      fetchMock.mockResolvedValue(makeResponse({}, 401, false));
      vi.mocked(authApi.refreshSession).mockRejectedValue(
        new Error('refresh failed'),
      );

      await expect(apiClient.get('/secure')).rejects.toThrow(
        'Unauthorized: 401',
      );
      expect(clearAuthMock).toHaveBeenCalledOnce();
      expect(location.href).toBe('/login');
    });

    it('403 응답 시 로그인으로 이동하지 않고 권한 부족 토스트를 표시한다', async () => {
      fetchMock.mockResolvedValue(makeResponse({}, 403, false));

      await expect(apiClient.get('/secure')).rejects.toThrow('Forbidden: 403');
      expect(clearAuthMock).not.toHaveBeenCalled();
      expect(location.href).toBe('');
      expect(message.error).toHaveBeenCalledWith('권한이 부족합니다.');
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
