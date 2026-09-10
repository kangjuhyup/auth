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
  let interactionCommand: any;
  let config: { get: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    config = {
      get: jest.fn(),
    };
    interactionCommand = {
      getDetails: jest.fn(),
      submitLogin: jest.fn(),
      submitMfa: jest.fn(),
      beginTotpEnrollment: jest.fn(),
      confirmTotpEnrollment: jest.fn(),
      submitPasswordChange: jest.fn(),
      submitConsent: jest.fn(),
      abort: jest.fn(),
      getWebAuthnOptions: jest.fn(),
      getIdpRedirect: jest.fn(),
      handleIdpCallback: jest.fn(),
      getSamlMetadata: jest.fn(),
      handleSamlCallback: jest.fn(),
    };

    controller = new InteractionController(interactionCommand, config as any);
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

    it('명시적으로 HTML 캐시를 켜면 빌드된 UI HTML을 읽어 캐시하고 반환한다', () => {
      const html = '<html><body>interaction-ui</body></html>';
      const res1 = createMockResponse();
      const res2 = createMockResponse();
      config.get.mockReturnValue('true');
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
      expect(res1.setHeader).not.toHaveBeenCalledWith(
        'Cache-Control',
        'no-store',
      );
    });

    it('기본값은 최신 UI HTML을 매 요청마다 읽고 no-store로 반환한다', () => {
      const html1 = '<html><body>interaction-ui-v1</body></html>';
      const html2 = '<html><body>interaction-ui-v2</body></html>';
      const res1 = createMockResponse();
      const res2 = createMockResponse();
      config.get.mockReturnValue(undefined);
      (existsSync as jest.MockedFunction<typeof existsSync>).mockReturnValue(
        true,
      );
      (readFileSync as jest.MockedFunction<typeof readFileSync>)
        .mockReturnValueOnce(html1)
        .mockReturnValueOnce(html2);

      controller.serveSpa(res1);
      controller.serveSpa(res2);

      expect(readFileSync).toHaveBeenCalledTimes(2);
      expect(res1.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(res2.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(res1.send).toHaveBeenCalledWith(html1);
      expect(res2.send).toHaveBeenCalledWith(html2);
    });
  });

  it('getDetails는 interaction flow 결과를 반환한다', async () => {
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
    interactionCommand.getDetails.mockResolvedValue(details);

    await controller.getDetails('acme', 'uid-1', req, res);

    expect(interactionCommand.getDetails).toHaveBeenCalledWith({
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
      interactionCommand.submitLogin.mockResolvedValue({
        status: 400,
        body: { error: 'tenant_not_found' },
      });

      await controller.submitLogin(
        'acme',
        'uid-1',
        { username: 'john', password: 'secret' },
        req,
        res,
      );

      expect(interactionCommand.submitLogin).toHaveBeenCalledWith({
        tenantCode: 'acme',
        uid: 'uid-1',
        username: 'john',
        password: 'secret',
        ipAddress: undefined,
        userAgent: undefined,
        correlationId: undefined,
        req,
        res,
        tenant: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'tenant_not_found' });
    });

    it('인증에 실패하면 401 응답을 반환한다', async () => {
      const req = createMockRequest({ tenant: makeTenantContext() }) as any;
      const res = createMockResponse();
      interactionCommand.submitLogin.mockResolvedValue({
        status: 401,
        body: { error: 'invalid_credentials' },
      });

      await controller.submitLogin(
        'acme',
        'uid-1',
        { username: 'john', password: 'wrong' },
        req,
        res,
      );

      expect(interactionCommand.submitLogin).toHaveBeenCalledWith({
        tenantCode: 'acme',
        uid: 'uid-1',
        username: 'john',
        password: 'wrong',
        ipAddress: undefined,
        userAgent: undefined,
        correlationId: undefined,
        req,
        res,
        tenant: makeTenantContext(),
      });
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'invalid_credentials' });
    });

    it('MFA가 필요하면 pending 세션을 저장하고 MFA 정보를 반환한다', async () => {
      const req = createMockRequest({ tenant: makeTenantContext() }) as any;
      const res = createMockResponse();
      interactionCommand.submitLogin.mockResolvedValue({
        body: {
          success: true,
          mfaRequired: true,
          methods: ['totp'],
        },
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
    });

    it('MFA가 필요 없으면 interaction completion redirect를 반환한다', async () => {
      const req = createMockRequest({ tenant: makeTenantContext() }) as any;
      const res = createMockResponse();
      interactionCommand.submitLogin.mockResolvedValue({
        body: {
          success: true,
          mfaRequired: false,
          redirectTo: '/interaction/continue',
        },
      });

      await controller.submitLogin(
        'acme',
        'uid-1',
        { username: 'john', password: 'secret' },
        req,
        res,
      );

      expect(interactionCommand.submitLogin).toHaveBeenCalledWith({
        tenantCode: 'acme',
        uid: 'uid-1',
        username: 'john',
        password: 'secret',
        ipAddress: undefined,
        userAgent: undefined,
        correlationId: undefined,
        req,
        res,
        tenant: makeTenantContext(),
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        mfaRequired: false,
        redirectTo: '/interaction/continue',
      });
    });

    it('body 기본값과 request metadata를 submitLogin에 전달한다', async () => {
      const tenant = makeTenantContext();
      const req = createMockRequest({
        tenant,
        ip: '203.0.113.10',
        get: jest.fn((name: string) => {
          const headers: Record<string, string | undefined> = {
            'user-agent': 'jest',
            'x-correlation-id': 'req-from-header',
            'x-request-id': 'req-from-request-id',
          };
          return headers[name.toLowerCase()];
        }) as any,
      }) as any;
      req.correlationId = 'req-from-middleware';
      const res = createMockResponse();
      interactionCommand.submitLogin.mockResolvedValue({
        status: undefined,
        body: { success: true },
      });

      await controller.submitLogin('acme', 'uid-1', {}, req, res);

      expect(interactionCommand.submitLogin).toHaveBeenCalledWith({
        tenantCode: 'acme',
        uid: 'uid-1',
        username: '',
        password: '',
        ipAddress: '203.0.113.10',
        userAgent: 'jest',
        correlationId: 'req-from-middleware',
        req,
        res,
        tenant,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('submitMfa', () => {
    it('pending MFA 세션이 없으면 400 응답을 반환한다', async () => {
      const req = createMockRequest() as any;
      const res = createMockResponse();
      interactionCommand.submitMfa.mockResolvedValue({
        status: 400,
        body: { error: 'no_pending_mfa' },
      });

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
      interactionCommand.submitMfa.mockResolvedValue({
        body: {
          success: true,
          redirectTo: '/interaction/done',
        },
      });

      await controller.submitMfa(
        'acme',
        'uid-1',
        { method: 'totp', code: '123456' },
        req,
        res,
      );

      expect(interactionCommand.submitMfa).toHaveBeenCalledWith({
        tenantCode: 'acme',
        uid: 'uid-1',
        method: 'totp',
        code: '123456',
        webauthnResponse: undefined,
        ipAddress: undefined,
        userAgent: undefined,
        correlationId: undefined,
        req,
        res,
        rpId: 'auth.example.com',
        expectedOrigin: 'https://auth.example.com',
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        redirectTo: '/interaction/done',
      });
    });

    it('host header가 없으면 localhost를 WebAuthn RP 기준으로 사용한다', async () => {
      const req = createMockRequest({
        get: jest.fn(() => undefined),
        protocol: 'http',
      }) as any;
      const res = createMockResponse();
      interactionCommand.submitMfa.mockResolvedValue({
        body: { success: true },
      });

      await controller.submitMfa(
        'acme',
        'uid-1',
        { method: 'webauthn', webauthnResponse: { id: 'credential-1' } },
        req,
        res,
      );

      expect(interactionCommand.submitMfa).toHaveBeenCalledWith({
        tenantCode: 'acme',
        uid: 'uid-1',
        method: 'webauthn',
        code: undefined,
        webauthnResponse: { id: 'credential-1' },
        ipAddress: undefined,
        userAgent: undefined,
        correlationId: undefined,
        req,
        res,
        rpId: 'localhost',
        expectedOrigin: 'http://localhost',
      });
    });
  });

  describe('interaction TOTP enrollment', () => {
    it('beginTotpEnrollment은 tenant context와 함께 command port에 위임한다', async () => {
      const tenant = makeTenantContext();
      const req = createMockRequest({ tenant }) as any;
      const res = createMockResponse();
      interactionCommand.beginTotpEnrollment.mockResolvedValue({
        body: {
          success: true,
          secret: 'totp-secret',
          otpauthUrl: 'otpauth://totp/Auth:john',
        },
      });

      await controller.beginTotpEnrollment('acme', 'uid-1', req, res);

      expect(interactionCommand.beginTotpEnrollment).toHaveBeenCalledWith({
        tenantCode: 'acme',
        uid: 'uid-1',
        tenant,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        secret: 'totp-secret',
        otpauthUrl: 'otpauth://totp/Auth:john',
      });
    });

    it('confirmTotpEnrollment은 검증 코드를 command port에 위임한다', async () => {
      const tenant = makeTenantContext();
      const req = createMockRequest({ tenant }) as any;
      const res = createMockResponse();
      interactionCommand.confirmTotpEnrollment.mockResolvedValue({
        body: {
          success: true,
          recoveryCodes: ['code-1'],
          redirectTo: '/interaction/done',
        },
      });

      await controller.confirmTotpEnrollment(
        'acme',
        'uid-1',
        { code: '123456' },
        req,
        res,
      );

      expect(interactionCommand.confirmTotpEnrollment).toHaveBeenCalledWith({
        tenantCode: 'acme',
        uid: 'uid-1',
        code: '123456',
        req,
        res,
        tenant,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        recoveryCodes: ['code-1'],
        redirectTo: '/interaction/done',
      });
    });
  });

  describe('submitPasswordChange', () => {
    it('password-change 요청을 command port에 위임한다', async () => {
      const req = createMockRequest() as any;
      const res = createMockResponse();
      interactionCommand.submitPasswordChange.mockResolvedValue({
        body: { success: true, redirectTo: '/interaction/done' },
      });

      await controller.submitPasswordChange(
        'acme',
        'uid-1',
        {
          currentPassword: 'temporary123',
          newPassword: 'new-password123',
        },
        req,
        res,
      );

      expect(interactionCommand.submitPasswordChange).toHaveBeenCalledWith({
        tenantCode: 'acme',
        uid: 'uid-1',
        currentPassword: 'temporary123',
        newPassword: 'new-password123',
        req,
        res,
        tenant: undefined,
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
    interactionCommand.submitConsent.mockResolvedValue({
      status: 400,
      body: { error: 'invalid_request' },
    });

    await controller.submitConsent('acme', 'uid-1', req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'invalid_request' });
  });

  it('submitConsent는 성공 redirect 결과를 JSON으로 반환한다', async () => {
    const req = createMockRequest() as any;
    const res = createMockResponse();
    interactionCommand.submitConsent.mockResolvedValue({
      redirectTo: '/interaction/complete',
    });

    await controller.submitConsent('acme', 'uid-1', req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      redirectTo: '/interaction/complete',
    });
  });

  it('abortInteraction은 port redirect를 반환한다', async () => {
    const req = createMockRequest() as any;
    const res = createMockResponse();
    interactionCommand.abort.mockResolvedValue({
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
    interactionCommand.getIdpRedirect.mockResolvedValue({
      redirectTo: 'https://accounts.example.com/oauth',
    });

    await controller.redirectToIdp('acme', 'uid-1', 'google', req, res);

    expect(interactionCommand.getIdpRedirect).toHaveBeenCalledWith({
      tenantCode: 'acme',
      uid: 'uid-1',
      providerName: 'google',
      req,
      res,
      tenant,
    });
    expect(res.redirect).toHaveBeenCalledWith(
      'https://accounts.example.com/oauth',
    );
  });

  it('redirectToIdp는 port 오류 body를 HTTP 오류로 매핑한다', async () => {
    const req = createMockRequest({ tenant: makeTenantContext() }) as any;
    const res = createMockResponse();
    interactionCommand.getIdpRedirect.mockResolvedValue({
      status: 404,
      body: { error: 'idp_not_found' },
    });

    await controller.redirectToIdp('acme', 'uid-1', 'google', req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'idp_not_found' });
  });

  it('idpCallback은 redirect 결과가 있으면 HTTP redirect로 매핑한다', async () => {
    const req = createMockRequest({ tenant: makeTenantContext() }) as any;
    const res = createMockResponse();
    interactionCommand.handleIdpCallback.mockResolvedValue({
      redirectTo: '/interaction/continue',
    });

    await controller.idpCallback('acme', 'uid-1', 'google', req, res);

    expect(interactionCommand.handleIdpCallback).toHaveBeenCalledWith({
      tenantCode: 'acme',
      uid: 'uid-1',
      providerName: 'google',
      req,
      res,
      tenant: makeTenantContext(),
    });
    expect(res.redirect).toHaveBeenCalledWith('/interaction/continue');
  });

  it('idpCallback은 redirect 결과가 없으면 응답을 추가로 쓰지 않는다', async () => {
    const req = createMockRequest({ tenant: makeTenantContext() }) as any;
    const res = createMockResponse();
    interactionCommand.handleIdpCallback.mockResolvedValue({});

    await controller.idpCallback('acme', 'uid-1', 'google', req, res);

    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('getWebAuthnOptions는 host와 protocol을 RP metadata로 전달한다', async () => {
    const req = createMockRequest({ host: 'auth.example.com:8443' }) as any;
    const res = createMockResponse();
    interactionCommand.getWebAuthnOptions.mockResolvedValue({
      status: undefined,
      body: { challenge: 'challenge-1' },
    });

    await controller.getWebAuthnOptions('uid-1', req, res);

    expect(interactionCommand.getWebAuthnOptions).toHaveBeenCalledWith({
      uid: 'uid-1',
      rpId: 'auth.example.com',
      expectedOrigin: 'https://auth.example.com:8443',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ challenge: 'challenge-1' });
  });

  it('samlMetadata는 XML 결과를 content-type과 함께 반환한다', async () => {
    const req = createMockRequest({ tenant: makeTenantContext() }) as any;
    const res = createMockResponse();
    interactionCommand.getSamlMetadata.mockResolvedValue({
      contentType: 'application/samlmetadata+xml',
      body: '<EntityDescriptor />',
    });

    await controller.samlMetadata('acme', 'okta', req, res);

    expect(res.type).toHaveBeenCalledWith('application/samlmetadata+xml');
    expect(res.send).toHaveBeenCalledWith('<EntityDescriptor />');
  });

  it('samlMetadata는 오류 body를 JSON 응답으로 반환한다', async () => {
    const req = createMockRequest({ tenant: makeTenantContext() }) as any;
    const res = createMockResponse();
    interactionCommand.getSamlMetadata.mockResolvedValue({
      status: 404,
      body: { error: 'idp_not_found' },
    });

    await controller.samlMetadata('acme', 'okta', req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'idp_not_found' });
  });

  it('samlCallback은 오류 body를 HTTP 오류로 매핑한다', async () => {
    const req = createMockRequest({ tenant: makeTenantContext() }) as any;
    const res = createMockResponse();
    interactionCommand.handleSamlCallback.mockResolvedValue({
      status: 400,
      body: { error: 'invalid_saml_response' },
    });

    await controller.samlCallback(
      'acme',
      'okta',
      { RelayState: 'state-1', SAMLResponse: 'response-1' },
      req,
      res,
    );

    expect(interactionCommand.handleSamlCallback).toHaveBeenCalledWith({
      tenantCode: 'acme',
      providerName: 'okta',
      relayState: 'state-1',
      samlResponse: 'response-1',
      req,
      res,
      tenant: makeTenantContext(),
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'invalid_saml_response' });
  });

  it('samlCallback은 redirect 결과가 있으면 HTTP redirect로 매핑한다', async () => {
    const req = createMockRequest({ tenant: makeTenantContext() }) as any;
    const res = createMockResponse();
    interactionCommand.handleSamlCallback.mockResolvedValue({
      redirectTo: '/interaction/continue',
    });

    await controller.samlCallback(
      'acme',
      'okta',
      { RelayState: undefined, SAMLResponse: 'response-1' },
      req,
      res,
    );

    expect(res.redirect).toHaveBeenCalledWith('/interaction/continue');
  });

  it('samlCallback은 redirect 결과가 없으면 응답을 추가로 쓰지 않는다', async () => {
    const req = createMockRequest({ tenant: makeTenantContext() }) as any;
    const res = createMockResponse();
    interactionCommand.handleSamlCallback.mockResolvedValue({});

    await controller.samlCallback(
      'acme',
      'okta',
      { RelayState: undefined, SAMLResponse: 'response-1' },
      req,
      res,
    );

    expect(res.redirect).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
