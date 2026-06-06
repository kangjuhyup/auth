import { describe, expect, it } from 'vitest';
import {
  buildIdpPayload,
  IdpFormPayloadError,
  parseSamlCertificates,
} from '@/features/identity-providers/idpFormPayload';

describe('identity provider form payload', () => {
  it('OAuth config JSON 을 payload 로 변환한다', () => {
    const payload = buildIdpPayload({
      provider: 'google',
      protocol: 'oauth2',
      displayName: 'Google',
      clientId: 'client-id',
      clientSecret: 'secret',
      redirectUri: 'https://auth.example.com/callback',
      enabled: true,
      oauthConfigJson:
        '{"authorizationUrl":"https://idp.example.com/auth","scopes":["openid","email"]}',
    });

    expect(payload).toMatchObject({
      protocol: 'oauth2',
      oauthConfig: {
        authorizationUrl: 'https://idp.example.com/auth',
        scopes: ['openid', 'email'],
      },
      samlConfig: null,
    });
  });

  it('SAML 설정 필드를 samlConfig 로 변환한다', () => {
    const payload = buildIdpPayload({
      provider: 'okta_saml',
      protocol: 'saml2',
      displayName: 'Okta',
      clientId: 'https://auth.example.com/saml/metadata',
      redirectUri:
        'https://auth.example.com/t/master/interaction/saml/okta_saml/callback',
      enabled: true,
      samlEntryPoint: 'https://okta.example.com/app/sso/saml',
      samlIdpCerts:
        '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----',
      samlAuthnContext:
        'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport,email',
      samlAttributeSub: 'uid',
      samlAttributeEmail: 'mail',
      samlWantAssertionsSigned: true,
      samlWantAuthnResponseSigned: true,
      samlForceAuthn: false,
      samlDisableRequestedAuthnContext: false,
      samlAcceptedClockSkewMs: 120000,
    });

    expect(payload).toMatchObject({
      protocol: 'saml2',
      clientSecret: null,
      oauthConfig: null,
      samlConfig: {
        entryPoint: 'https://okta.example.com/app/sso/saml',
        idpCerts: [
          '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----',
        ],
        authnContext: [
          'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport',
          'email',
        ],
        attributeMapping: { sub: 'uid', email: 'mail' },
        acceptedClockSkewMs: 120000,
      },
    });
  });

  it('여러 PEM 인증서를 각각 보존한다', () => {
    const certs = parseSamlCertificates(
      '-----BEGIN CERTIFICATE-----\nfirst\n-----END CERTIFICATE-----\n\n-----BEGIN CERTIFICATE-----\nsecond\n-----END CERTIFICATE-----',
    );

    expect(certs).toEqual([
      '-----BEGIN CERTIFICATE-----\nfirst\n-----END CERTIFICATE-----',
      '-----BEGIN CERTIFICATE-----\nsecond\n-----END CERTIFICATE-----',
    ]);
  });

  it('SAML 인증서가 없으면 필드 오류를 반환한다', () => {
    expect(() =>
      buildIdpPayload({
        protocol: 'saml2',
        samlEntryPoint: 'https://okta.example.com/app/sso/saml',
        samlIdpCerts: '',
      }),
    ).toThrow(IdpFormPayloadError);
  });
});
