import { BadRequestException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { OidcDelegateMiddleware } from '@presentation/http/oidc.middleware';

type ProviderLike = {
  callback: () => (req: any, res: any) => any;
};

type RegistryLike = {
  get: (tenantCode: string) => ProviderLike;
};

describe('OidcDelegateMiddleware', () => {
  const makeReq = (overrides: Partial<Request> = {}): Request =>
    ({
      params: {},
      url: '/',
      ...overrides,
    }) as any;

  const makeRes = (): Response => ({}) as any;

  it('tenantCode가 없으면 BadRequestException을 던진다', () => {
    const registry: RegistryLike = {
      get: jest.fn(),
    };
    const mw = new OidcDelegateMiddleware(registry as any);

    const req = makeReq({ params: {} as any });

    expect(() => mw.use(req, makeRes())).toThrow(BadRequestException);
    expect(registry.get).not.toHaveBeenCalled();
  });

  it('tenantCode가 배열이면 BadRequestException을 던진다', () => {
    const registry: RegistryLike = {
      get: jest.fn(),
    };
    const mw = new OidcDelegateMiddleware(registry as any);

    const req = makeReq({ params: { tenantCode: ['a', 'b'] } as any });

    expect(() => mw.use(req, makeRes())).toThrow(BadRequestException);
    expect(registry.get).not.toHaveBeenCalled();
  });

  it('tenantCode가 문자열이면 registry.get을 호출한다', () => {
    const provider: ProviderLike = {
      callback: jest.fn().mockReturnValue(jest.fn()),
    };
    const registry: RegistryLike = {
      get: jest.fn().mockReturnValue(provider),
    };
    const mw = new OidcDelegateMiddleware(registry as any);

    const req = makeReq({ params: { tenantCode: 'tenant-a' } as any });

    mw.use(req, makeRes());

    expect(registry.get).toHaveBeenCalledTimes(1);
    expect(registry.get).toHaveBeenCalledWith('tenant-a');
  });

  it('요청 URL에서 /t/{tenantCode}/oidc prefix를 제거하고 provider.callback을 호출한다', () => {
    const handler = jest.fn();
    const provider: ProviderLike = {
      callback: jest.fn().mockReturnValue(handler),
    };
    const registry: RegistryLike = {
      get: jest.fn().mockReturnValue(provider),
    };
    const mw = new OidcDelegateMiddleware(registry as any);

    const req = makeReq({
      params: { tenantCode: 'tenant-a' } as any,
      url: '/t/tenant-a/oidc/.well-known/openid-configuration',
    });

    const res = makeRes();

    mw.use(req, res);

    expect(req.url).toBe('/.well-known/openid-configuration');
    expect(provider.callback).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(req, res);
  });

  it('URL이 prefix로 시작하지 않으면 url을 변경하지 않고 provider.callback을 호출한다', () => {
    const handler = jest.fn();
    const provider: ProviderLike = {
      callback: jest.fn().mockReturnValue(handler),
    };
    const registry: RegistryLike = {
      get: jest.fn().mockReturnValue(provider),
    };
    const mw = new OidcDelegateMiddleware(registry as any);

    const req = makeReq({
      params: { tenantCode: 'tenant-a' } as any,
      url: '/something-else',
    });

    const res = makeRes();

    mw.use(req, res);

    expect(req.url).toBe('/something-else');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('prefix만 있는 경우 url을 "/"로 만든다', () => {
    const handler = jest.fn();
    const provider: ProviderLike = {
      callback: jest.fn().mockReturnValue(handler),
    };
    const registry: RegistryLike = {
      get: jest.fn().mockReturnValue(provider),
    };
    const mw = new OidcDelegateMiddleware(registry as any);

    const req = makeReq({
      params: { tenantCode: 'tenant-a' } as any,
      url: '/t/tenant-a/oidc',
    });

    const res = makeRes();

    mw.use(req, res);

    expect(req.url).toBe('/');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
