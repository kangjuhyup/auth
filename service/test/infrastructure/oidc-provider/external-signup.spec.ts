import { createHash } from 'node:crypto';
import { OidcInteractionAdapter } from '@infrastructure/oidc-provider/oidc-interaction.adapter';
const tenant = { id: 'tenant', code: 'demo', name: 'Demo' };
const browserHash = createHash('sha256')
  .update('uid123456\0signature')
  .digest('hex');
const req = () => ({
  headers: {
    cookie: '_interaction_demo=uid123456; _interaction_demo.sig=signature',
  },
  query: {},
});
function setup() {
  const provider = {
    issuer: 'https://auth.example/t/demo/oidc',
    interactionDetails: jest.fn(async () => ({
      uid: 'uid123456',
      prompt: { name: 'login' },
      params: { client_id: 'app' },
    })),
    Interaction: {
      find: jest.fn(async () => ({
        uid: 'uid123456',
        params: { client_id: 'app' },
      })),
    },
  };
  const config = {
    provider: 'kakao',
    protocol: 'oauth2',
    enabled: true,
    clientId: 'kakao-client',
    clientSecret: 'secret',
    oauthConfig: null,
  };
  const identities = { findByProviderSub: jest.fn(async () => null) };
  const store = {
    putState: jest.fn(),
    consumeState: jest.fn(),
    putIdentity: jest.fn(),
    consumeIdentity: jest.fn(),
    issueTicket: jest.fn(),
    getInteractionTicket: jest.fn(async () => null),
    getTicket: jest.fn(),
  };
  const idp = {
    getAuthorizationUrl: jest.fn(
      () => 'https://kauth.kakao.com/oauth/authorize',
    ),
    exchangeCode: jest.fn(async () => ({
      sub: '123',
      profile: { ci: 'sensitive', nickname: 'safe' },
    })),
  };
  const adapter = new OidcInteractionAdapter(
    { get: jest.fn(async () => provider) } as any,
    { findByClientRefId: jest.fn(async () => null) } as any,
    { findByClientId: jest.fn(async () => ({ id: 'app-id' })) } as any,
    { findByTenantId: jest.fn(async () => null) } as any,
    { findByTenantAndProvider: jest.fn(async () => config) } as any,
    identities as any,
    idp as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    store as any,
  );
  const binding = {
    tenantId: 'tenant',
    tenantCode: 'demo',
    clientId: 'app',
    uid: 'uid123456',
    provider: 'kakao',
    redirectUri: 'https://auth.example/t/demo/interaction/idp/kakao/callback',
    intent: 'login',
    browserHash,
    callbackHash: createHash('sha256').update('callback-browser').digest('hex'),
  };
  return { adapter, provider, identities, store, idp, config, binding };
}
describe('Kakao proof remains bound to the initiating browser and interaction', () => {
  it('uses a fixed callback and opaque state rather than exposing the interaction in state', async () => {
    const { adapter, store, idp } = setup();
    await adapter.getIdpRedirect({
      tenantCode: 'demo',
      uid: 'uid123456',
      providerName: 'kakao',
      tenant,
      req: req(),
      res: { cookie: jest.fn() },
    });
    expect(store.putState.mock.calls[0][0]).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(store.putState.mock.calls[0][1]).toMatchObject({
      browserHash,
      clientId: 'app',
      uid: 'uid123456',
    });
    expect(
      (idp.getAuthorizationUrl.mock.calls[0] as unknown as unknown[])[3],
    ).toBe('https://auth.example/t/demo/interaction/idp/kakao/callback');
  });
  it.each(['tenant', 'provider', 'browser', 'expired'])(
    'rejects a mismatched or expired %s state before code exchange',
    async (kind) => {
      const { adapter, store, idp, binding } = setup();
      store.consumeState.mockResolvedValue(
        kind === 'expired'
          ? null
          : {
              ...binding,
              ...(kind === 'tenant' ? { tenantId: 'other' } : {}),
              ...(kind === 'provider' ? { provider: 'other' } : {}),
              ...(kind === 'browser' ? { callbackHash: 'other' } : {}),
            },
      );
      await adapter.handleIdpCallback({
        tenantCode: 'demo',
        providerName: 'kakao',
        tenant,
        req: {
          headers: { cookie: '_external_oauth_kakao=callback-browser' },
          query: { state: 'A'.repeat(43), code: 'code' },
        },
        res: { clearCookie: jest.fn() },
      });
      expect(idp.exchangeCode).not.toHaveBeenCalled();
    },
  );
  it('stores only minimal verified identity after atomically consuming state', async () => {
    const { adapter, store, binding } = setup();
    store.consumeState.mockResolvedValue(binding);
    expect(
      await adapter.handleIdpCallback({
        tenantCode: 'demo',
        providerName: 'kakao',
        tenant,
        req: {
          headers: { cookie: '_external_oauth_kakao=callback-browser' },
          query: { state: 'A'.repeat(43), code: 'code' },
        },
        res: { clearCookie: jest.fn() },
      }),
    ).toEqual({
      redirectTo: '/t/demo/interaction/uid123456/idp/kakao/continue',
    });
    expect(store.putIdentity.mock.calls[0][0].profile).toEqual({
      nickname: 'safe',
    });
  });
  it('issues a new-user ticket without creating an Auth user or identity', async () => {
    const { adapter, store, binding, identities } = setup();
    store.consumeIdentity.mockResolvedValue({
      ...binding,
      providerSub: '123',
      profile: {},
    });
    await adapter.continueIdpLogin({
      tenantCode: 'demo',
      uid: 'uid123456',
      providerName: 'kakao',
      tenant,
      req: req(),
      res: {},
    });
    expect(store.issueTicket).toHaveBeenCalledTimes(1);
    expect(identities.findByProviderSub).toHaveBeenCalled();
  });
  it('explicit signup intent can recover a linked identity without moving it', async () => {
    const { adapter, store, binding, identities } = setup();
    store.consumeIdentity.mockResolvedValue({
      ...binding,
      intent: 'signup',
      providerSub: '123',
      profile: {},
    });
    identities.findByProviderSub.mockResolvedValue({
      userId: 'existing',
    } as any);
    await adapter.continueIdpLogin({
      tenantCode: 'demo',
      uid: 'uid123456',
      providerName: 'kakao',
      tenant,
      req: req(),
      res: {},
    });
    expect(store.issueTicket).toHaveBeenCalled();
  });
  it('ordinary linked login returns identity for shared status/MFA handling', async () => {
    const { adapter, store, binding, identities } = setup();
    store.consumeIdentity.mockResolvedValue({
      ...binding,
      providerSub: '123',
      profile: {},
    });
    identities.findByProviderSub.mockResolvedValue({
      userId: 'existing',
    } as any);
    expect(
      await adapter.continueIdpLogin({
        tenantCode: 'demo',
        uid: 'uid123456',
        providerName: 'kakao',
        tenant,
        req: req(),
        res: {},
      }),
    ).toEqual({ uid: 'uid123456', userId: 'existing' });
    expect(store.issueTicket).not.toHaveBeenCalled();
  });
  it.each(['uid', 'client', 'browser', 'attempt', 'subject', 'expiry'])(
    'rejects changed %s at browser resume',
    async (kind) => {
      const { adapter, store, binding, identities } = setup();
      const ticket = {
        ...binding,
        ticket: 'ticket',
        attemptId: 'attempt',
        subject: 'existing',
        providerSub: '123',
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        ...(kind === 'uid' ? { uid: 'other' } : {}),
        ...(kind === 'client' ? { clientId: 'other' } : {}),
        ...(kind === 'browser' ? { browserHash: 'other' } : {}),
        ...(kind === 'attempt' ? { attemptId: 'other' } : {}),
        ...(kind === 'subject' ? { subject: 'other' } : {}),
        ...(kind === 'expiry' ? { expiresAt: '2020-01-01' } : {}),
      };
      store.getTicket.mockResolvedValue(ticket);
      identities.findByProviderSub.mockResolvedValue({
        userId: 'existing',
      } as any);
      await expect(
        adapter.resolveExternalSignup({
          tenantCode: 'demo',
          uid: 'uid123456',
          ticket: 'ticket',
          attemptId: 'attempt',
          tenant,
          req: req(),
          res: {},
        }),
      ).rejects.toThrow('interaction_denied');
    },
  );
});
