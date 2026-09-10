import { ExternalInteractionUiService } from '@application/services/external-interaction-ui.service';
import { ClientModel } from '@domain/models/client';

function makeClient(externalInteractionUiUrl: string | null) {
  return new ClientModel(
    {
      tenantId: 'tenant-1',
      clientId: 'web-app',
      secretEnc: null,
      name: 'Web app',
      type: 'public',
      enabled: true,
      redirectUris: ['https://app.example.com/callback'],
      grantTypes: ['authorization_code'],
      responseTypes: ['code'],
      tokenEndpointAuthMethod: 'none',
      scope: 'openid',
      postLogoutRedirectUris: [],
      applicationType: 'web',
      backchannelLogoutUri: null,
      frontchannelLogoutUri: null,
      externalInteractionUiUrl,
      allowedResources: [],
      introspectionResources: [],
      skipConsent: false,
    },
    'client-ref-1',
  );
}

function setup(externalInteractionUiUrl: string | null) {
  const oidcInteraction = {
    getDetails: jest.fn().mockResolvedValue({
      uid: 'uid_12345678',
      prompt: 'login',
      clientId: 'web-app',
      missingScopes: [],
      mfaRequired: false,
      idpList: [],
    }),
    findInteractionBinding: jest
      .fn()
      .mockResolvedValue({ clientId: 'web-app' }),
  };
  const tenantContext = {
    findByCode: jest
      .fn()
      .mockResolvedValue({ id: 'tenant-1', code: 'acme', name: 'Acme' }),
  };
  const clientRepository = {
    findByClientId: jest
      .fn()
      .mockResolvedValue(makeClient(externalInteractionUiUrl)),
  };
  const access = {
    issue: jest.fn().mockResolvedValue({
      accessToken: 'signed-token',
      csrfToken: 'csrf-token',
      browserBinding: 'browser-binding',
      claims: {
        accessId: 'access-1',
        tenantId: 'tenant-1',
        tenantCode: 'acme',
        clientId: 'web-app',
        uid: 'uid_12345678',
        origin: 'https://login.example.com',
        expiresAt: new Date(Date.now() + 300_000),
      },
    }),
    verify: jest.fn().mockResolvedValue({
      accessId: 'access-1',
      tenantId: 'tenant-1',
      tenantCode: 'acme',
      clientId: 'web-app',
      uid: 'uid_12345678',
      origin: 'https://login.example.com',
      expiresAt: new Date(Date.now() + 300_000),
    }),
    consume: jest.fn().mockResolvedValue(true),
  };
  return {
    service: new ExternalInteractionUiService(
      oidcInteraction as any,
      tenantContext as any,
      clientRepository as any,
      access as any,
    ),
    oidcInteraction,
    tenantContext,
    clientRepository,
    access,
  };
}

describe('ExternalInteractionUiService', () => {
  it('설정되지 않은 client는 기존 embedded UI로 fallback한다', async () => {
    const { service, access } = setup(null);

    await expect(
      service.prepare({
        tenantCode: 'acme',
        uid: 'uid_12345678',
        req: {},
        res: {},
        tenant: { id: 'tenant-1', code: 'acme', name: 'Acme' },
      }),
    ).resolves.toEqual({ mode: 'embedded' });
    expect(access.issue).not.toHaveBeenCalled();
  });

  it('외부 UI에는 최소 query와 fragment credential만 전달한다', async () => {
    const { service } = setup(
      'https://login.example.com/interaction?theme=dark&uid=attacker',
    );

    const result = await service.prepare({
      tenantCode: 'acme',
      uid: 'uid_12345678',
      req: {},
      res: {},
      tenant: { id: 'tenant-1', code: 'acme', name: 'Acme' },
    });

    expect(result.mode).toBe('external');
    if (result.mode !== 'external') throw new Error('external expected');
    const url = new URL(result.redirectTo);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      theme: 'dark',
      uid: 'uid_12345678',
      tenantCode: 'acme',
    });
    expect(Object.fromEntries(new URLSearchParams(url.hash.slice(1)))).toEqual({
      interaction_token: 'signed-token',
      csrf_token: 'csrf-token',
    });
    expect(result.redirectTo).not.toContain('redirect_uri');
    expect(result.redirectTo).not.toContain('code_challenge');
    expect(result.redirectTo).not.toContain('state=');
  });

  it('CORS origin은 interaction에 묶인 client의 exact origin만 반환한다', async () => {
    const { service } = setup('https://login.example.com/interaction');

    await expect(
      service.resolveCorsOrigin({
        tenantCode: 'acme',
        uid: 'uid_12345678',
      }),
    ).resolves.toBe('https://login.example.com');
  });

  it('origin, tenant, client, uid와 access/CSRF/browser binding을 함께 검증한다', async () => {
    const { service, access } = setup('https://login.example.com/interaction');

    await expect(
      service.authorize({
        tenantCode: 'acme',
        uid: 'uid_12345678',
        origin: 'https://login.example.com',
        accessToken: 'signed-token',
        csrfToken: 'csrf-token',
        browserBinding: 'browser-binding',
      }),
    ).resolves.toMatchObject({
      mode: 'external',
      access: { accessId: 'access-1', clientId: 'web-app' },
    });
    expect(access.verify).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        tenantCode: 'acme',
        clientId: 'web-app',
        uid: 'uid_12345678',
        origin: 'https://login.example.com',
      }),
    );
  });

  it.each([
    ['임의 origin', { origin: 'https://evil.example.com' }],
    ['access token 누락', { accessToken: undefined }],
    ['CSRF 누락', { csrfToken: undefined }],
    ['browser binding 누락', { browserBinding: undefined }],
  ])('%s 요청을 거부한다', async (_name, override) => {
    const { service } = setup('https://login.example.com/interaction');

    await expect(
      service.authorize({
        tenantCode: 'acme',
        uid: 'uid_12345678',
        origin: 'https://login.example.com',
        accessToken: 'signed-token',
        csrfToken: 'csrf-token',
        browserBinding: 'browser-binding',
        ...override,
      }),
    ).rejects.toThrow('External interaction request denied');
  });

  it('다른 tenant provider에 없거나 다른 client로 묶인 interaction은 거부한다', async () => {
    const { service, oidcInteraction, access } = setup(
      'https://login.example.com/interaction',
    );
    oidcInteraction.findInteractionBinding.mockResolvedValue(null);

    await expect(
      service.authorize({
        tenantCode: 'other',
        uid: 'uid_12345678',
      }),
    ).rejects.toThrow('External interaction request denied');
    expect(access.verify).not.toHaveBeenCalled();
  });
});
