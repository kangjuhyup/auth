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

  beforeEach(() => {
    jest.clearAllMocks();
    interactionCommand = {
      getDetails: jest.fn(),
      submitLogin: jest.fn(),
      submitMfa: jest.fn(),
      submitConsent: jest.fn(),
      abort: jest.fn(),
      getWebAuthnOptions: jest.fn(),
      getIdpRedirect: jest.fn(),
      handleIdpCallback: jest.fn(),
      getSamlMetadata: jest.fn(),
      handleSamlCallback: jest.fn(),
    };

    controller = new InteractionController(interactionCommand);
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
      tenant,
    });
    expect(res.redirect).toHaveBeenCalledWith(
      'https://accounts.example.com/oauth',
    );
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
});
