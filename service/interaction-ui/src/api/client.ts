export interface InteractionDetails {
  uid: string;
  prompt: 'login' | 'consent' | string;
  clientId: string;
  missingScopes: string[];
  mfaRequired: boolean;
  idpList: { provider: string; name: string }[];
}

export interface LoginResult {
  success: boolean;
  mfaRequired: boolean;
  methods?: string[];
  redirectTo?: string;
}

export interface MfaResult {
  success: boolean;
  redirectTo?: string;
}

export interface ConsentResult {
  success: boolean;
  redirectTo?: string;
}

export interface AbortResult {
  redirectTo: string;
}

function apiBase(): string {
  const path = window.location.pathname;
  // URL: /t/{tenant}/interaction/{uid}
  // API: /t/{tenant}/interaction/{uid}/api/...
  return path;
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function getDetails(): Promise<InteractionDetails> {
  return request(`${apiBase()}/api/details`);
}

export function submitLogin(
  username: string,
  password: string,
): Promise<LoginResult> {
  return request(`${apiBase()}/api/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function submitMfa(
  method: string,
  code?: string,
  webauthnResponse?: Record<string, unknown>,
): Promise<MfaResult> {
  return request(`${apiBase()}/api/mfa`, {
    method: 'POST',
    body: JSON.stringify({ method, code, webauthnResponse }),
  });
}

export function submitConsent(): Promise<ConsentResult> {
  return request(`${apiBase()}/api/consent`, {
    method: 'POST',
  });
}

export function abortInteraction(): Promise<AbortResult> {
  return request(`${apiBase()}/api/abort`);
}

export function getIdpUrl(provider: string): string {
  return `${apiBase()}/idp/${provider}`;
}
