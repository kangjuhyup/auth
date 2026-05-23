jest.mock('node:fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

import { existsSync, readFileSync } from 'node:fs';
import { InteractionController } from '@presentation/controllers/interaction.controller';
import {
  createMockRequest,
  createMockResponse,
  makeTenantContext,
} from './support/controller-test-helpers';

describe('InteractionController', () => {
  let controller: InteractionController;
  let userQuery: any;
  let oidcInteraction: any;

  beforeEach(() => {
    jest.clearAllMocks();
    userQuery = {
      authenticate: jest.fn(),
      getMfaMethods: jest.fn(),
      verifyMfa: jest.fn(),
    };
    oidcInteraction = {
      getDetails: jest.fn(),
      completeLogin: jest.fn(),
      completeConsent: jest.fn(),
      abort: jest.fn(),
      getIdpRedirect: jest.fn(),
      handleIdpCallback: jest.fn(),
      getSamlMetadata: jest.fn(),
      handleSamlCallback: jest.fn(),
    };

    controller = new InteractionController(userQuery, oidcInteraction);
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
      (
        readFileSync as jest.MockedFunction<typeof readFileSync>
      ).mockReturnValue(html);

      controller.serveSpa(res1);
      controller.serveSpa(res2);

      expect(readFileSync).toHaveBeenCalledTimes(1);
      expect(res1.type).toHaveBeenCalledWith('html');
      expect(res1.send).toHaveBeenCalledWith(html);
      expect(res2.send).toHaveBeenCalledWith(html);
    });
  });

  it('getDetails는 OIDC interaction port 결과를 반환한다', async () => {
    const tenant = makeTenantContext();
    const req = createMockRequest({ tenant }) as any;
    const res = createMockResponse();
    const details = {
      uid: 'uid-1',
      prompt: 'login',
      clientId: 'web-app',
      missingScopes: [],
      mfaRequired: false,
      idpList: [],
    };
    oidcInteraction.getDetails.mockResolvedValue(details);

    await controller.getDetails('acme', 'uid-1', req, res);

    expect(oidcInteraction.getDetails).toHaveBeenCalledWith({
      tenantCode: 'acme',
      uid: 'uid-1',
      req,
      res,
      tenant,
    });
    expect(res.json).toHaveBeenCalledWith(details);
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
      oidcInteraction.getDetails.mockResolvedValue({
        mfaRequired: true,
        idpList: [],
        missingScopes: [],
        prompt: 'login',
        clientId: 'web-app',
        uid: 'uid-1',
      });

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

    it('MFA가 필요 없으면 interaction completion redirect를 반환한다', async () => {
      const req = createMockRequest({ tenant: makeTenantContext() }) as any;
      const res = createMockResponse();
      userQuery.authenticate.mockResolvedValue({ userId: 'user-1' });
      oidcInteraction.getDetails.mockResolvedValue({
        mfaRequired: false,
        idpList: [],
        missingScopes: [],
        prompt: 'login',
        clientId: 'web-app',
        uid: 'uid-1',
      });
      oidcInteraction.completeLogin.mockResolvedValue({
        redirectTo: '/interaction/continue',
      });

      await controller.submitLogin(
        'acme',
        'uid-1',
        { username: 'john', password: 'secret' },
        req,
        res,
      );

      expect(oidcInteraction.completeLogin).toHaveBeenCalledWith({
        tenantCode: 'acme',
        req,
        res,
        userId: 'user-1',
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

    it('MFA 검증에 성공하면 pending 세션을 제거하고 redirect를 반환한다', async () => {
      const req = createMockRequest({ host: 'auth.example.com' }) as any;
      const res = createMockResponse();
      ((controller as any).mfaPendingSessions as Map<string, unknown>).set(
        'uid-1',
        {
          userId: 'user-1',
          tenantId: 'tenant-1',
          expiresAt: Date.now() + 1000,
        },
      );
      userQuery.verifyMfa.mockResolvedValue(true);
      oidcInteraction.completeLogin.mockResolvedValue({
        redirectTo: '/interaction/done',
      });

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
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        redirectTo: '/interaction/done',
      });
    });
  });

  it('submitConsent는 port의 JSON 오류를 HTTP 오류로 매핑한다', async () => {
    const req = createMockRequest() as any;
    const res = createMockResponse();
    oidcInteraction.completeConsent.mockResolvedValue({
      status: 400,
      body: { error: 'invalid_request' },
    });

    await controller.submitConsent('acme', 'uid-1', req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'invalid_request' });
  });

  it('abortInteraction은 port redirect를 반환한다', async () => {
    const req = createMockRequest() as any;
    const res = createMockResponse();
    oidcInteraction.abort.mockResolvedValue({
      redirectTo: '/interaction/abort',
    });

    await controller.abortInteraction('acme', 'uid-1', req, res);

    expect(res.json).toHaveBeenCalledWith({
      redirectTo: '/interaction/abort',
    });
  });

  it('redirectToIdp는 port redirect를 HTTP redirect로 매핑한다', async () => {
    const tenant = makeTenantContext();
    const req = createMockRequest({ tenant }) as any;
    const res = createMockResponse();
    oidcInteraction.getIdpRedirect.mockResolvedValue({
      redirectTo: 'https://accounts.example.com/oauth',
    });

    await controller.redirectToIdp('acme', 'uid-1', 'google', req, res);

    expect(oidcInteraction.getIdpRedirect).toHaveBeenCalledWith({
      tenantCode: 'acme',
      uid: 'uid-1',
      providerName: 'google',
      req,
      tenant,
    });
    expect(res.redirect).toHaveBeenCalledWith(
      'https://accounts.example.com/oauth',
    );
  });

  it('samlMetadata는 XML 결과를 content-type과 함께 반환한다', async () => {
    const req = createMockRequest({ tenant: makeTenantContext() }) as any;
    const res = createMockResponse();
    oidcInteraction.getSamlMetadata.mockResolvedValue({
      contentType: 'application/samlmetadata+xml',
      body: '<EntityDescriptor />',
    });

    await controller.samlMetadata('acme', 'okta', req, res);

    expect(res.type).toHaveBeenCalledWith('application/samlmetadata+xml');
    expect(res.send).toHaveBeenCalledWith('<EntityDescriptor />');
  });
});
