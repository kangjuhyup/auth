import type { PaginationQuery, PaginatedResult, TenantContext } from '@application/dto';
import type { AuthenticatedUser } from '@application/ports/access-verifier.port';
import type { Request, Response } from 'express';

export function makeTenantContext(
  overrides: Partial<TenantContext> = {},
): TenantContext {
  return {
    id: 'tenant-1',
    code: 'acme',
    name: 'Acme Corp',
    ...overrides,
  };
}

export function makeAuthenticatedUser(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  return {
    userId: 'user-1',
    ...overrides,
  };
}

export function makePaginationQuery(
  overrides: Partial<PaginationQuery> = {},
): PaginationQuery {
  return {
    page: 1,
    limit: 20,
    ...overrides,
  };
}

export function makePaginatedResult<T>(
  items: T[] = [],
  total = items.length,
  page = 1,
  limit = 20,
): PaginatedResult<T> {
  return {
    items,
    total,
    page,
    limit,
  };
}

export function createMockRequest(
  overrides: Partial<Request> & { tenant?: unknown; host?: string } = {},
): Request {
  const { host, ...rest } = overrides;
  const req: any = {
    protocol: 'https',
    params: {},
    query: {},
    body: {},
    headers: {},
    ...rest,
  };

  if (!req.get) {
    const headerHost =
      typeof req.headers?.host === 'string' ? req.headers.host : undefined;
    const resolvedHost = host ?? headerHost ?? 'auth.example.com';
    req.get = jest.fn((name: string) =>
      name.toLowerCase() === 'host' ? resolvedHost : undefined,
    );
  }

  return req as Request;
}

export function createMockResponse(): Response {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
  };

  return res as Response;
}
