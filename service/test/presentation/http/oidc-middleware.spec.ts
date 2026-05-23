import { BadRequestException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { OidcDelegateMiddleware } from '@presentation/http/oidc.middleware';

describe('OidcDelegateMiddleware', () => {
  const makeReq = (overrides: Partial<Request> = {}): Request =>
    ({
      params: {},
      url: '/',
      ...overrides,
    }) as any;

  const makeRes = (): Response => ({}) as any;

  const makeOidcInteraction = () => ({
    delegateProviderCallback: jest.fn().mockResolvedValue(undefined),
  });

  it('tenantCode가 없으면 BadRequestException을 던진다', async () => {
    const oidcInteraction = makeOidcInteraction();
    const mw = new OidcDelegateMiddleware(oidcInteraction as any);

    const req = makeReq({ params: {} as any });

    await expect(mw.use(req, makeRes())).rejects.toThrow(BadRequestException);
    expect(oidcInteraction.delegateProviderCallback).not.toHaveBeenCalled();
  });

  it('tenantCode가 배열이면 BadRequestException을 던진다', async () => {
    const oidcInteraction = makeOidcInteraction();
    const mw = new OidcDelegateMiddleware(oidcInteraction as any);

    const req = makeReq({ params: { tenantCode: ['a', 'b'] } as any });

    await expect(mw.use(req, makeRes())).rejects.toThrow(BadRequestException);
    expect(oidcInteraction.delegateProviderCallback).not.toHaveBeenCalled();
  });

  it('tenantCode가 문자열이면 OIDC interaction port에 위임한다', async () => {
    const oidcInteraction = makeOidcInteraction();
    const mw = new OidcDelegateMiddleware(oidcInteraction as any);
    const req = makeReq({ params: { tenantCode: 'tenant-a' } as any });
    const res = makeRes();

    await mw.use(req, res);

    expect(oidcInteraction.delegateProviderCallback).toHaveBeenCalledTimes(1);
    expect(oidcInteraction.delegateProviderCallback).toHaveBeenCalledWith({
      tenantCode: 'tenant-a',
      req,
      res,
    });
  });
});
