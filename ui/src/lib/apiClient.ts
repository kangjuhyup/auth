import { message } from 'antd';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  skipAuthRefresh?: boolean;
  skipUnauthorizedRedirect?: boolean;
}

let refreshPromise: Promise<boolean> | null = null;

async function parseResponseBody<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    body,
    headers: customHeaders,
    params,
    skipAuthRefresh = false,
    skipUnauthorizedRedirect = false,
    ...restOptions
  } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  // Build URL with query params
  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value != null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const response = await fetch(url, {
    ...restOptions,
    credentials: restOptions.credentials ?? 'include',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    if (!skipAuthRefresh) {
      const refreshed = await tryRefreshSession();
      if (refreshed) {
        return request<T>(endpoint, {
          ...options,
          skipAuthRefresh: true,
        });
      }
    }

    if (!skipUnauthorizedRedirect) {
      await handleUnauthorized();
    }

    throw new Error(`Unauthorized: ${response.status}`);
  }

  if (response.status === 403) {
    message.error('권한이 부족합니다.');
    throw new Error(`Forbidden: ${response.status}`);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `API Error: ${response.status}`);
  }

  return parseResponseBody<T>(response);
}

async function tryRefreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const [{ authApi }, { useAuthStore }] = await Promise.all([
        import('@/features/auth/api/authApi'),
        import('@/stores/auth.store'),
      ]);
      const session = await authApi.refreshSession();
      useAuthStore
        .getState()
        .login(session.username, session.passwordChangeRequired);
      return true;
    })()
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

async function handleUnauthorized(): Promise<void> {
  try {
    const { useAuthStore } = await import('@/stores/auth.store');
    useAuthStore.getState().clearAuth();
  } catch {
    // Store not available
  }

  window.location.href = '/login';
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
