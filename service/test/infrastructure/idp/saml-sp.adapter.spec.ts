const samlInstances: any[] = [];

jest.mock('@node-saml/node-saml', () => ({
  ValidateInResponseTo: { always: 'always' },
  SAML: jest.fn().mockImplementation(function (this: any, config: any) {
    this.config = config;
    this.getAuthorizeUrlAsync = jest
      .fn()
      .mockResolvedValue('https://idp.example.com/sso?SAMLRequest=req');
    this.validatePostResponseAsync = jest.fn().mockResolvedValue({
      profile: {
        nameID: 'saml-sub',
        email: 'user@example.com',
        issuer: 'https://idp.example.com',
      },
    });
    this.generateServiceProviderMetadata = jest
      .fn()
      .mockReturnValue('<EntityDescriptor />');
    samlInstances.push(this);
  }),
}));

import { SAML } from '@node-saml/node-saml';
import { SamlSpAdapter } from '@infrastructure/idp/saml-sp.adapter';

describe('SamlSpAdapter', () => {
  let relayStateRepository: any;
  let cacheProviderFactory: any;
  let cacheProvider: any;
  let adapter: SamlSpAdapter;

  const baseParams = {
    tenantId: 'tenant-1',
    provider: 'okta',
    issuer: 'https://auth.example.com/saml/okta/metadata',
    callbackUrl:
      'https://auth.example.com/t/acme/interaction/saml/okta/callback',
    config: {
      entryPoint: 'https://okta.example.com/app/sso/saml',
      idpCerts: ['cert-1'],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    samlInstances.length = 0;
    relayStateRepository = {
      save: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(true),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    cacheProvider = { save: jest.fn(), get: jest.fn(), remove: jest.fn() };
    cacheProviderFactory = {
      create: jest.fn().mockReturnValue(cacheProvider),
    };
    adapter = new SamlSpAdapter(relayStateRepository, cacheProviderFactory);
  });

  it('AuthnRequest URL 생성 시 RelayState와 request id cache 설정을 구성한다', async () => {
    const url = await adapter.getLoginUrl({
      ...baseParams,
      relayState: 'uid:uid-1:nonce',
    });

    expect(url).toBe('https://idp.example.com/sso?SAMLRequest=req');
    expect(relayStateRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        provider: 'okta',
        relayState: 'uid:uid-1:nonce',
      }),
      600,
    );
    expect(cacheProviderFactory.create).toHaveBeenCalledWith({
      keyPrefix: 'saml:request:tenant-1:okta',
      ttlSeconds: 600,
    });
    expect(SAML).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackUrl: baseParams.callbackUrl,
        entryPoint: 'https://okta.example.com/app/sso/saml',
        issuer: baseParams.issuer,
        audience: baseParams.issuer,
        idpCert: 'cert-1',
        validateInResponseTo: 'always',
        wantAssertionsSigned: true,
        wantAuthnResponseSigned: true,
        signatureAlgorithm: 'sha256',
        digestAlgorithm: 'sha256',
        cacheProvider,
      }),
    );
    expect(samlInstances[0].getAuthorizeUrlAsync).toHaveBeenCalledWith(
      'uid:uid-1:nonce',
      undefined,
      {},
    );
  });

  it('SAMLResponse를 검증하고 profile을 IdP user info로 매핑한다', async () => {
    const result = await adapter.validatePostResponse({
      ...baseParams,
      relayState: 'uid:uid-1:nonce',
      samlResponse: 'saml-response',
    });

    expect(relayStateRepository.exists).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        provider: 'okta',
        relayState: 'uid:uid-1:nonce',
      }),
    );
    expect(samlInstances[0].validatePostResponseAsync).toHaveBeenCalledWith({
      SAMLResponse: 'saml-response',
      RelayState: 'uid:uid-1:nonce',
    });
    expect(relayStateRepository.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        provider: 'okta',
        relayState: 'uid:uid-1:nonce',
      }),
    );
    expect(result).toEqual({
      sub: 'saml-sub',
      email: 'user@example.com',
      profile: {
        nameID: 'saml-sub',
        email: 'user@example.com',
        issuer: 'https://idp.example.com',
      },
    });
  });

  it('RelayState가 저장되어 있지 않으면 응답 검증을 거부한다', async () => {
    relayStateRepository.exists.mockResolvedValue(false);

    await expect(
      adapter.validatePostResponse({
        ...baseParams,
        relayState: 'uid:uid-1:nonce',
        samlResponse: 'saml-response',
      }),
    ).rejects.toThrow(/RelayState/);
  });

  it('SP metadata XML을 생성한다', () => {
    const metadata = adapter.generateMetadata(baseParams);

    expect(metadata).toBe('<EntityDescriptor />');
    expect(
      samlInstances[0].generateServiceProviderMetadata,
    ).toHaveBeenCalledWith(null, null);
  });
});
