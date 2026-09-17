import { ExternalInteractionGuard } from '@presentation/http/external-interaction.guard';

function context(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe('ExternalInteractionGuard', () => {
  it('embedded client 요청은 기존 same-origin interaction API를 유지한다', async () => {
    const externalInteractionUi = {
      authorize: jest.fn().mockResolvedValue({ mode: 'embedded' }),
    };
    const guard = new ExternalInteractionGuard(externalInteractionUi as any);

    await expect(
      guard.canActivate(
        context({
          params: { tenantCode: 'acme', uid: 'uid_12345678' },
          headers: {},
        }),
      ),
    ).resolves.toBe(true);
  });

  it('외부 요청의 bearer, CSRF, origin, browser cookie를 검증하고 access context를 저장한다', async () => {
    const access = {
      accessId: 'access-1',
      tenantId: 'tenant-1',
      tenantCode: 'acme',
      clientId: 'web-app',
      uid: 'uid_12345678',
      origin: 'https://login.example.com',
      expiresAt: new Date(),
    };
    const externalInteractionUi = {
      authorize: jest.fn().mockResolvedValue({ mode: 'external', access }),
    };
    const guard = new ExternalInteractionGuard(externalInteractionUi as any);
    const request: any = {
      params: { tenantCode: 'acme', uid: 'uid_12345678' },
      headers: {
        origin: 'https://login.example.com',
        authorization: 'Bearer signed.token.value',
        'x-interaction-csrf': 'csrf-token',
        cookie: '_external_interaction_acme=browser-binding',
      },
    };

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(externalInteractionUi.authorize).toHaveBeenCalledWith({
      tenantCode: 'acme',
      uid: 'uid_12345678',
      origin: 'https://login.example.com',
      accessToken: 'signed.token.value',
      csrfToken: 'csrf-token',
      browserBinding: 'browser-binding',
    });
    expect(request.externalInteractionAccess).toBe(access);
  });

  it('변조되거나 누락된 credential 거부를 우회하지 않는다', async () => {
    const externalInteractionUi = {
      authorize: jest
        .fn()
        .mockRejectedValue(new Error('External interaction request denied')),
    };
    const guard = new ExternalInteractionGuard(externalInteractionUi as any);

    await expect(
      guard.canActivate(
        context({
          params: { tenantCode: 'acme', uid: 'uid_tampered1' },
          headers: { origin: 'https://evil.example.com' },
        }),
      ),
    ).rejects.toThrow('External interaction request denied');
  });
});
