import { debugInteraction } from '../lib/debug';

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
  mfaRequired?: boolean;
  mfaEnrollmentRequired?: boolean;
  passwordChangeRequired?: boolean;
  methods?: string[];
  redirectTo?: string;
}

export interface TotpEnrollmentResult {
  success: boolean;
  secret: string;
  otpauthUrl: string;
}

export interface TotpEnrollmentConfirmationResult {
  success: boolean;
  recoveryCodes: string[];
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
  operation: string,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const method = options?.method ?? 'GET';
  debugInteraction('api.request', { operation, method });
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  debugInteraction('api.response', {
    operation,
    method,
    status: res.status,
    ok: res.ok,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    debugInteraction('api.error', {
      operation,
      method,
      status: res.status,
      error:
        typeof body.error === 'string'
          ? body.error
          : typeof body.message === 'string'
            ? body.message
            : 'unknown',
    });
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function getDetails(): Promise<InteractionDetails> {
  return request('details', `${apiBase()}/api/details`);
}

export function submitLogin(
  username: string,
  password: string,
): Promise<LoginResult> {
  return request('login', `${apiBase()}/api/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function submitMfa(
  method: string,
  code?: string,
  webauthnResponse?: Record<string, unknown>,
): Promise<MfaResult> {
  return request('mfa', `${apiBase()}/api/mfa`, {
    method: 'POST',
    body: JSON.stringify({ method, code, webauthnResponse }),
  });
}

export function beginTotpEnrollment(): Promise<TotpEnrollmentResult> {
  return request('mfa.totp.enroll', `${apiBase()}/api/mfa/totp/enroll`, {
    method: 'POST',
  });
}

export function confirmTotpEnrollment(
  code: string,
): Promise<TotpEnrollmentConfirmationResult> {
  return request('mfa.totp.confirm', `${apiBase()}/api/mfa/totp/confirm`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export function submitPasswordChange(
  currentPassword: string,
  newPassword: string,
): Promise<LoginResult> {
  return request('password-change', `${apiBase()}/api/password-change`, {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function submitConsent(): Promise<ConsentResult> {
  return request('consent', `${apiBase()}/api/consent`, {
    method: 'POST',
  });
}

export function abortInteraction(): Promise<AbortResult> {
  return request('abort', `${apiBase()}/api/abort`);
}

export function getIdpUrl(provider: string): string {
  return `${apiBase()}/idp/${provider}`;
}
