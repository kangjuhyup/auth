jest.mock('node:fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

jest.mock('node:crypto', () => ({
  randomBytes: jest.fn(() =>
    Buffer.from('00112233445566778899aabbccddeeff', 'hex'),
  ),
}));

import { existsSync, readFileSync } from 'node:fs';
import { InteractionController } from '@presentation/controllers/interaction.controller';
import { ClientModel } from '@domain/models/client';
import { ClientAuthPolicyModel } from '@domain/models/client-auth-policy';
import { IdentityProviderModel, type IdpProvider } from '@domain/models/identity-provider';
import { UserIdentityModel } from '@domain/models/user-identity';
import {
  createMockRequest,
  createMockResponse,
  makeTenantContext,
} from './support/controller-test-helpers';

function makeClient(id = 'client-ref-1', clientId = 'web-app'): ClientModel {
  const client = new ClientModel({
    tenantId: 'tenant-1',
    clientId,
    secretEnc: null,
    name: 'Web App',
    type: 'public',
    enabled: true,
    redirectUris: ['https://app.example.com/callback'],
    grantTypes: ['authorization_code'],
    responseTypes: ['code'],
    tokenEndpointAuthMethod: 'none',
    scope: 'openid profile',
    postLogoutRedirectUris: [],
    applicationType: 'web',
    backchannelLogoutUri: null,
    frontchannelLogoutUri: null,
    allowedResources: [],
    skipConsent: false,
  });

  client.setPersistence(id, new Date(), new Date());
  return client;
}

function makePolicy(
  clientRefId = 'client-ref-1',
  mfaRequired = true,
): ClientAuthPolicyModel {
  return new ClientAuthPolicyModel(
    {
      tenantId: 'tenant-1',
      clientRefId,
      allowedAuthMethods: ['password'],
      defaultAcr: 'urn:acr:loa1',
      mfaRequired,
      allowedMfaMethods: ['totp'],
      maxSessionDurationSec: null,
      consentRequired: true,
      requireAuthTime: false,
    },
    'policy-1',
  );
}

function makeIdp(
  provider: IdpProvider,
  displayName: string,
  enabled = true,
): IdentityProviderModel {
  const idp = new IdentityProviderModel({
    tenantId: 'tenant-1',
    provider,
    displayName,
    clientId: `${provider}-client`,
    clientSecret: `${provider}-secret`,
    redirectUri: `https://auth.example.com/${provider}/callback`,
    enabled,
  });

  idp.setPersistence(`idp-${provider}`, new Date(), new Date());
  return idp;
}

function makeIdentity(
  provider: IdpProvider = 'google',
  providerSub = 'google-sub',
): UserIdentityModel {
  const identity = new UserIdentityModel({
    tenantId: 'tenant-1',
    userId: 'user-1',
    provider,
    providerSub,
    email: 'user@example.com',
    profileJson: { sub: providerSub },
    linkedAt: new Date(),
  });

  identity.setPersistence('identity-1', new Date(), new Date());
  return identity;
}

function createMockProvider() {
  const interactionDetails = jest.fn();
  const interactionResult = jest.fn();
  const interactionFinished = jest.fn().mockResolvedValue(undefined);
  const clientFind = jest.fn();
  const accessTokenSave = jest.fn().mockResolvedValue('access-token');
  const AccessToken = jest
    .fn()
    .mockImplementation(function (this: any, payload: Record<string, unknown>) {
      this.payload = payload;
      this.save = accessTokenSave;
    });

  const grantInstances: any[] = [];
  const Grant: any = jest
    .fn()
    .mockImplementation(function (this: any, params: Record<string, unknown>) {
      this.params = params;
      this.addOIDCScope = jest.fn();
      this.save = jest.fn().mockResolvedValue('grant-1');
      grantInstances.push(this);
    });
  Grant.find = jest.fn().mockResolvedValue(null);

  return {
    provider: {
      interactionDetails,
      interactionResult,
      interactionFinished,
      Client: { find: clientFind },
      AccessToken,
      Grant,
    } as any,
    interactionDetails,
    interactionResult,
    interactionFinished,
    clientFind,
    accessTokenSave,
    AccessToken,
    Grant,
    grantInstances,
  };
}

describe('InteractionController', () => {
  let controller: InteractionController;
  let registry: any;
  let userQuery: any;
  let clientAuthPolicyRepo: any;
  let clientRepo: any;
  let idpRepo: any;
  let userIdentityRepo: any;
  let idpPort: any;
  let providerBundle: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    jest.clearAllMocks();
    providerBundle = createMockProvider();
    registry = {
      get: jest.fn().mockResolvedValue(providerBundle.provider),
    };
    userQuery = {
      findProfile: jest.fn(),
      findClaimsBySub: jest.fn(),
      findByUsername: jest.fn(),
      authenticate: jest.fn(),
      getMfaMethods: jest.fn(),
      verifyMfa: jest.fn(),
    };
    clientAuthPolicyRepo = {
      findByClientRefId: jest.fn(),
    };
    clientRepo = {
      findById: jest.fn(),
      findByClientId: jest.fn(),
      list: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    idpRepo = {
      findByTenantAndProvider: jest.fn(),
      listEnabledByTenant: jest.fn(),
    };
    userIdentityRepo = {
      findByProviderSub: jest.fn(),
      save: jest.fn(),
    };
    idpPort = {
      getAuthorizationUrl: jest.fn(),
      exchangeCode: jest.fn(),
    };

    controller = new InteractionController(
      registry,
      userQuery,
      clientAuthPolicyRepo,
      clientRepo,
      idpRepo,
      userIdentityRepo,
      idpPort,
    );
  });

  describe('serveSpa', () => {
    it('빌드된 UI가 없으면 404 응답을 반환한다', () => {
      const res = createMockResponse();
      (existsSync as jest.MockedFunction<typeof existsSync>).mockReturnValue(
        false,
      );

      controller.serveSpa(res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Interaction UI not built',
      });
    });

    it('빌드된 UI가 있으면 HTML을 읽어 캐시하고 반환한다', () => {
      const html = '<html><body>interaction-ui</body></html>';
      const res1 = createMockResponse();
      const res2 = createMockResponse();
      (existsSync as jest.MockedFunction<typeof existsSync>).mockReturnValue(
        true,
      );
      (readFileSync as jest.MockedFunction<typeof readFileSync>).mockReturnValue(
        html,
      );

      controller.serveSpa(res1);
      controller.serveSpa(res2);

      expect(readFileSync).toHaveBeenCalledTimes(1);
      expect(res1.type).toHaveBeenCalledWith('html');
      expect(res1.send).toHaveBeenCalledWith(html);
      expect(res2.send).toHaveBeenCalledWith(html);
    });
  });

  describe('getDetails', () => {
    it('interaction 상세와 IdP/MFA 정보를 조합해 반환한다', async () => {
      const req = createMockRequest({ tenant: makeTenantContext() }) as any;
      const res = createMockResponse();
      providerBundle.interactionDetails.mockResolvedValue({
        prompt: {
          name: 'consent',
          details: { missingOIDCScope: ['openid', 'profile'] },
        },
        params: { client_id: 'web-app' },
      });
      idpRepo.listEnabledByTenant.mockResolvedValue([
        makeIdp('google', 'Google'),
        makeIdp('kakao', 'Kakao'),
      ]);
      clientRepo.findByClientId.mockResolvedValue(makeClient());
      clientAuthPolicyRepo.findByClientRefId.mockResolvedValue(makePolicy());

      await controller.getDetails('acme', 'uid-1', req, res);

      expect(registry.get).toHaveBeenCalledWith('acme');
      expect(providerBundle.interactionDetails).toHaveBeenCalledWith(req, res);
      expect(res.json).toHaveBeenCalledWith({
        uid: 'uid-1',
        prompt: 'consent',
        clientId: 'web-app',
        missingScopes: ['openid', 'profile'],
        mfaRequired: true,
        idpList: [
          { provider: 'google', name: 'Google' },
          { provider: 'kakao', name: 'Kakao' },
        ],
      });
    });
  });

  describe('submitLogin', () => {
    it('tenant가 없으면 400 응답을 반환한다', async () => {
      const req = createMockRequest() as any;
      const res = createMockResponse();

      await controller.submitLogin(
        'acme',
        'uid-1',
        { username: 'john', password: 'secret' },
        req,
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'tenant_not_found' });
    });

    it('인증에 실패하면 401 응답을 반환한다', async () => {
      const req = createMockRequest({ tenant: makeTenantContext() }) as any;
      const res = createMockResponse();
      userQuery.authenticate.mockResolvedValue(null);

      await controller.submitLogin(
        'acme',
        'uid-1',
        { username: 'john', password: 'wrong' },
        req,
        res,
      );

      expect(userQuery.authenticate).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        username: 'john',
        password: 'wrong',
      });
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'invalid_credentials' });
    });

    it('MFA가 필요하면 pending 세션을 저장하고 MFA 정보를 반환한다', async () => {
      const req = createMockRequest({ tenant: makeTenantContext() }) as any;
      const res = createMockResponse();
      userQuery.authenticate.mockResolvedValue({ userId: 'user-1' });
      userQuery.getMfaMethods.mockResolvedValue(['totp']);
      providerBundle.interactionDetails.mockResolvedValue({
        params: { client_id: 'web-app' },
      });
      clientRepo.findByClientId.mockResolvedValue(makeClient());
      clientAuthPolicyRepo.findByClientRefId.mockResolvedValue(makePolicy());

      await controller.submitLogin(
        'acme',
        'uid-1',
        { username: 'john', password: 'secret' },
        req,
        res,
      );

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        mfaRequired: true,
        methods: ['totp'],
      });
      expect(
        ((controller as any).mfaPendingSessions as Map<string, unknown>).has(
          'uid-1',
        ),
      ).toBe(true);
    });

    it('MFA가 필요 없으면 interaction 결과 redirect를 반환한다', async () => {
      const req = createMockRequest({ tenant: makeTenantContext() }) as any;
      const res = createMockResponse();
      userQuery.authenticate.mockResolvedValue({ userId: 'user-1' });
      providerBundle.interactionDetails.mockResolvedValue({
        params: { client_id: 'web-app' },
      });
      clientRepo.findByClientId.mockResolvedValue(makeClient());
      clientAuthPolicyRepo.findByClientRefId.mockResolvedValue(
        makePolicy('client-ref-1', false),
      );
      providerBundle.interactionResult.mockResolvedValue('/interaction/continue');

      await controller.submitLogin(
        'acme',
        'uid-1',
        { username: 'john', password: 'secret' },
        req,
        res,
      );

      expect(providerBundle.interactionResult).toHaveBeenCalledWith(req, res, {
        login: { accountId: 'user-1' },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        mfaRequired: false,
        redirectTo: '/interaction/continue',
      });
    });
  });

  describe('submitMfa', () => {
    it('pending MFA 세션이 없으면 400 응답을 반환한다', async () => {
      const req = createMockRequest() as any;
      const res = createMockResponse();

      await controller.submitMfa(
        'acme',
        'uid-1',
        { method: 'totp', code: '123456' },
        req,
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'no_pending_mfa' });
    });

    it('MFA 검증에 실패하면 401 응답을 반환한다', async () => {
      const req = createMockRequest() as any;
      const res = createMockResponse();
      ((controller as any).mfaPendingSessions as Map<string, unknown>).set(
        'uid-1',
        {
          userId: 'user-1',
          tenantId: 'tenant-1',
        },
      );
      userQuery.verifyMfa.mockResolvedValue(false);

      await controller.submitMfa(
        'acme',
        'uid-1',
        { method: 'totp', code: '123456' },
        req,
        res,
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'mfa_failed' });
    });

    it('MFA 검증에 성공하면 pending 세션을 제거하고 redirect를 반환한다', async () => {
      const req = createMockRequest({ host: 'auth.example.com' }) as any;
      const res = createMockResponse();
      ((controller as any).mfaPendingSessions as Map<string, unknown>).set(
        'uid-1',
        {
          userId: 'user-1',
          tenantId: 'tenant-1',
        },
      );
      userQuery.verifyMfa.mockResolvedValue(true);
      providerBundle.interactionResult.mockResolvedValue('/interaction/done');

      await controller.submitMfa(
        'acme',
        'uid-1',
        { method: 'totp', code: '123456' },
        req,
        res,
      );

      expect(userQuery.verifyMfa).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        method: 'totp',
        code: '123456',
        webauthnResponse: undefined,
        rpId: 'auth.example.com',
        expectedOrigin: 'https://auth.example.com',
      });
      expect(
        ((controller as any).mfaPendingSessions as Map<string, unknown>).has(
          'uid-1',
        ),
      ).toBe(false);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        redirectTo: '/interaction/done',
      });
    });
  });

  describe('submitConsent', () => {
    it('유효한 consent interaction이 아니면 400 응답을 반환한다', async () => {
      const req = createMockRequest() as any;
      const res = createMockResponse();
      providerBundle.interactionDetails.mockResolvedValue({
        prompt: { name: 'login', details: {} },
        params: { client_id: 'web-app' },
        session: null,
      });

      await controller.submitConsent('acme', 'uid-1', req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'invalid_request',
        message: 'No active consent interaction',
      });
    });

    it('기존 grant가 있으면 재사용하고 missing scope를 추가한다', async () => {
      const req = createMockRequest() as any;
      const res = createMockResponse();
      const existingGrant = {
        addOIDCScope: jest.fn(),
        save: jest.fn().mockResolvedValue('grant-existing'),
      };
      providerBundle.interactionDetails.mockResolvedValue({
        prompt: {
          name: 'consent',
          details: { missingOIDCScope: ['openid', 'profile'] },
        },
        params: { client_id: 'web-app' },
        session: { accountId: 'user-1' },
        grantId: 'grant-1',
      });
      providerBundle.Grant.find.mockResolvedValue(existingGrant);
      providerBundle.interactionResult.mockResolvedValue('/interaction/consent');

      await controller.submitConsent('acme', 'uid-1', req, res);

      expect(providerBundle.Grant.find).toHaveBeenCalledWith('grant-1');
      expect(existingGrant.addOIDCScope).toHaveBeenCalledWith(
        'openid profile',
      );
      expect(existingGrant.save).toHaveBeenCalledTimes(1);
      expect(providerBundle.interactionResult).toHaveBeenCalledWith(req, res, {
        consent: { grantId: 'grant-existing' },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        redirectTo: '/interaction/consent',
      });
    });

    it('grantId가 없으면 신규 grant를 생성한다', async () => {
      const req = createMockRequest() as any;
      const res = createMockResponse();
      providerBundle.interactionDetails.mockResolvedValue({
        prompt: { name: 'consent', details: {} },
        params: { client_id: 'web-app' },
        session: { accountId: 'user-1' },
      });
      providerBundle.interactionResult.mockResolvedValue('/interaction/consent');

      await controller.submitConsent('acme', 'uid-1', req, res);

      expect(providerBundle.Grant).toHaveBeenCalledWith({
        accountId: 'user-1',
        clientId: 'web-app',
      });
      expect(providerBundle.grantInstances[0].save).toHaveBeenCalledTimes(1);
    });
  });

  describe('abortInteraction', () => {
    it('access_denied 결과 redirect를 반환한다', async () => {
      const req = createMockRequest() as any;
      const res = createMockResponse();
      providerBundle.interactionResult.mockResolvedValue('/interaction/abort');

      await controller.abortInteraction('acme', 'uid-1', req, res);

      expect(providerBundle.interactionResult).toHaveBeenCalledWith(req, res, {
        error: 'access_denied',
        error_description: 'End-User aborted interaction',
      });
      expect(res.json).toHaveBeenCalledWith({
        redirectTo: '/interaction/abort',
      });
    });
  });

  describe('getWebAuthnOptions', () => {
    it('pending MFA 세션이 없으면 400 응답을 반환한다', async () => {
      const req = createMockRequest() as any;
      const res = createMockResponse();

      await controller.getWebAuthnOptions('uid-1', req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'no_pending_mfa' });
    });

    it('pending MFA 세션이 있으면 WebAuthn 옵션을 반환한다', async () => {
      const req = createMockRequest({ host: 'auth.example.com' }) as any;
      const res = createMockResponse();
      const options = { challenge: 'challenge-1' };
      ((controller as any).mfaPendingSessions as Map<string, unknown>).set(
        'uid-1',
        {
          userId: 'user-1',
          tenantId: 'tenant-1',
        },
      );
      userQuery.verifyMfa.mockResolvedValue(options as any);

      await controller.getWebAuthnOptions('uid-1', req, res);

      expect(userQuery.verifyMfa).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        method: 'webauthn',
        rpId: 'auth.example.com',
        expectedOrigin: 'https://auth.example.com',
      });
      expect(res.json).toHaveBeenCalledWith(options);
    });
  });

  describe('redirectToIdp', () => {
    it('tenant가 없으면 400 응답을 반환한다', async () => {
      const req = createMockRequest() as any;
      const res = createMockResponse();

      await controller.redirectToIdp('acme', 'uid-1', 'google', req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'tenant_not_found' });
    });

    it('IdP 설정이 없거나 비활성이면 404 응답을 반환한다', async () => {
      const req = createMockRequest({ tenant: makeTenantContext() }) as any;
      const res = createMockResponse();
      idpRepo.findByTenantAndProvider.mockResolvedValue(null);

      await controller.redirectToIdp('acme', 'uid-1', 'google', req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'idp_not_found' });
    });

    it('정상 설정이면 IdP authorization URL로 redirect한다', async () => {
      const req = createMockRequest({
        tenant: makeTenantContext(),
        host: 'auth.example.com',
      }) as any;
      const res = createMockResponse();
      idpRepo.findByTenantAndProvider.mockResolvedValue(
        makeIdp('google', 'Google'),
      );
      idpPort.getAuthorizationUrl.mockReturnValue(
        'https://accounts.example.com/oauth',
      );

      await controller.redirectToIdp('acme', 'uid-1', 'google', req, res);

      expect(idpPort.getAuthorizationUrl).toHaveBeenCalledWith(
        'google',
        'google-client',
        'https://auth.example.com/t/acme/interaction/uid-1/idp/google/callback',
        'uid-1:00112233445566778899aabbccddeeff',
      );
      expect(res.redirect).toHaveBeenCalledWith(
        'https://accounts.example.com/oauth',
      );
    });
  });

  describe('idpCallback', () => {
    it('tenant가 없으면 tenant_not_found 에러로 redirect한다', async () => {
      const req = createMockRequest() as any;
      const res = createMockResponse();

      await controller.idpCallback('acme', 'uid-1', 'google', req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        '/t/acme/interaction/uid-1?error=tenant_not_found',
      );
    });

    it('authorization code가 없으면 idp_no_code 에러로 redirect한다', async () => {
      const req = createMockRequest({
        tenant: makeTenantContext(),
        query: {},
      }) as any;
      const res = createMockResponse();

      await controller.idpCallback('acme', 'uid-1', 'google', req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        '/t/acme/interaction/uid-1?error=idp_no_code',
      );
    });

    it('IdP 설정이 없으면 idp_not_found 에러로 redirect한다', async () => {
      const req = createMockRequest({
        tenant: makeTenantContext(),
        query: { code: 'auth-code' },
      }) as any;
      const res = createMockResponse();
      idpRepo.findByTenantAndProvider.mockResolvedValue(null);

      await controller.idpCallback('acme', 'uid-1', 'google', req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        '/t/acme/interaction/uid-1?error=idp_not_found',
      );
    });

    it('IdP 코드 교환이 실패하면 idp_exchange_failed 에러로 redirect한다', async () => {
      const req = createMockRequest({
        tenant: makeTenantContext(),
        query: { code: 'auth-code' },
        host: 'auth.example.com',
      }) as any;
      const res = createMockResponse();
      idpRepo.findByTenantAndProvider.mockResolvedValue(
        makeIdp('google', 'Google'),
      );
      idpPort.exchangeCode.mockRejectedValue(new Error('exchange failed'));

      await controller.idpCallback('acme', 'uid-1', 'google', req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        '/t/acme/interaction/uid-1?error=idp_exchange_failed',
      );
    });

    it('연결된 유저가 없으면 idp_user_not_linked 에러로 redirect한다', async () => {
      const req = createMockRequest({
        tenant: makeTenantContext(),
        query: { code: 'auth-code' },
        host: 'auth.example.com',
      }) as any;
      const res = createMockResponse();
      idpRepo.findByTenantAndProvider.mockResolvedValue(
        makeIdp('google', 'Google'),
      );
      idpPort.exchangeCode.mockResolvedValue({
        sub: 'google-sub',
        email: 'user@example.com',
      });
      userIdentityRepo.findByProviderSub.mockResolvedValue(null);

      await controller.idpCallback('acme', 'uid-1', 'google', req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        '/t/acme/interaction/uid-1?error=idp_user_not_linked',
      );
    });

    it('연결된 유저가 있으면 interactionFinished를 호출한다', async () => {
      const req = createMockRequest({
        tenant: makeTenantContext(),
        query: { code: 'auth-code' },
        host: 'auth.example.com',
      }) as any;
      const res = createMockResponse();
      idpRepo.findByTenantAndProvider.mockResolvedValue(
        makeIdp('google', 'Google'),
      );
      idpPort.exchangeCode.mockResolvedValue({
        sub: 'google-sub',
        email: 'user@example.com',
      });
      userIdentityRepo.findByProviderSub.mockResolvedValue(makeIdentity());

      await expect(
        controller.idpCallback('acme', 'uid-1', 'google', req, res),
      ).resolves.toBeUndefined();

      expect(idpPort.exchangeCode).toHaveBeenCalledWith(
        'google',
        'google-client',
        'google-secret',
        'auth-code',
        'https://auth.example.com/t/acme/interaction/uid-1/idp/google/callback',
      );
      expect(userIdentityRepo.findByProviderSub).toHaveBeenCalledWith(
        'tenant-1',
        'google',
        'google-sub',
      );
      expect(providerBundle.interactionFinished).toHaveBeenCalledWith(req, res, {
        login: { accountId: 'user-1' },
      });
    });
  });
});
