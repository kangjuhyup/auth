import type { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';

export const ADMIN_SESSION_COOKIE_NAME = 'admin_session';

const DEFAULT_MAX_AGE_SEC = 60 * 60;

function getConfigValue(
  config: ConfigService,
  key: string,
  fallback: string,
): string {
  return config.get<string>(key) ?? fallback;
}

function getBooleanConfig(
  config: ConfigService,
  key: string,
  fallback: boolean,
): boolean {
  const value = config.get<string>(key);
  if (value === undefined) {
    return fallback;
  }

  return value.trim().toLowerCase() === 'true';
}

function normalizeSameSite(value: string): CookieOptions['sameSite'] {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'strict' || normalized === 'none') {
    return normalized;
  }

  return 'lax';
}

export function buildAdminSessionCookieOptions(
  config: ConfigService,
): CookieOptions {
  const sameSite = normalizeSameSite(
    getConfigValue(config, 'ADMIN_SESSION_COOKIE_SAME_SITE', 'lax'),
  );
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const secure =
    sameSite === 'none'
      ? true
      : getBooleanConfig(config, 'ADMIN_SESSION_COOKIE_SECURE', isProduction);
  const maxAgeSec = Number(
    getConfigValue(
      config,
      'ADMIN_SESSION_COOKIE_MAX_AGE_SEC',
      String(DEFAULT_MAX_AGE_SEC),
    ),
  );

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: Number.isFinite(maxAgeSec)
      ? Math.max(1, maxAgeSec) * 1000
      : DEFAULT_MAX_AGE_SEC * 1000,
  };
}

export function setAdminSessionCookie(
  response: Response,
  config: ConfigService,
  token: string,
): void {
  response.cookie(
    ADMIN_SESSION_COOKIE_NAME,
    token,
    buildAdminSessionCookieOptions(config),
  );
}

export function clearAdminSessionCookie(
  response: Response,
  config: ConfigService,
): void {
  const options = buildAdminSessionCookieOptions(config);

  response.clearCookie(ADMIN_SESSION_COOKIE_NAME, {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
  });
}

export function resolveAdminSessionToken(request: Request): string | null {
  const cookieToken = readCookie(
    request.headers.cookie,
    ADMIN_SESSION_COOKIE_NAME,
  );
  if (cookieToken) {
    return cookieToken;
  }

  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return null;
  }

  const bearerToken = auth.slice(7).trim();
  return bearerToken === '' ? null : bearerToken;
}

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) {
    return null;
  }

  const prefix = `${name}=`;
  const pair = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!pair) {
    return null;
  }

  const rawValue = pair.slice(prefix.length);
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}
