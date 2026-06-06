import { maskObject } from '@kangjuhyup/rvlog';
import {
  AdminLoginDto,
  CreateClientDto,
  CreateIdentityProviderDto,
  InteractionLoginDto,
  InteractionMfaDto,
  PasswordResetDto,
  SamlCallbackDto,
  SignupDto,
  TotpConfirmationDto,
  UpdateProfileDto,
} from '@presentation/dto';

function maskWith<T extends object>(DtoClass: new () => T, body: object) {
  return maskObject(body, undefined, DtoClass.prototype) as Record<
    string,
    unknown
  >;
}

describe('presentation DTO log masking', () => {
  it('인증 요청의 password, token, code와 개인정보를 마스킹한다', () => {
    expect(
      maskWith(SignupDto, {
        username: 'alice',
        password: 'Passw0rd!',
        email: 'user@example.com',
        phone: '01012345678',
      }),
    ).toMatchObject({
      username: 'alice',
      password: '******',
      email: 'us***@example.com',
      phone: '010-****-5678',
    });

    expect(
      maskWith(PasswordResetDto, {
        token: 'reset-token',
        newPassword: 'NewPass1!',
      }),
    ).toMatchObject({
      token: '******',
      newPassword: '******',
    });

    expect(maskWith(TotpConfirmationDto, { code: '123456' })).toMatchObject({
      code: '******',
    });

    expect(
      maskWith(UpdateProfileDto, {
        email: 'new@example.com',
        phone: '+821012345678',
      }),
    ).toMatchObject({
      email: 'ne***@example.com',
      phone: '821-****-5678',
    });
  });

  it('관리자와 클라이언트 secret 필드를 마스킹한다', () => {
    expect(
      maskWith(AdminLoginDto, {
        username: 'admin',
        password: 'admin-secret',
      }),
    ).toMatchObject({
      username: 'admin',
      password: '******',
    });

    expect(
      maskWith(CreateClientDto, {
        clientId: 'console',
        secret: 'x'.repeat(32),
      }),
    ).toMatchObject({
      clientId: 'console',
      secret: '******',
    });

    expect(
      maskWith(CreateIdentityProviderDto, {
        provider: 'google',
        clientId: 'google-client',
        clientSecret: 'google-secret',
      }),
    ).toMatchObject({
      provider: 'google',
      clientId: 'google-client',
      clientSecret: '******',
    });
  });

  it('interaction body의 password, MFA, SAML 값을 마스킹한다', () => {
    expect(
      maskWith(InteractionLoginDto, {
        username: 'john',
        password: 'login-secret',
      }),
    ).toMatchObject({
      username: 'john',
      password: '******',
    });

    expect(
      maskWith(InteractionMfaDto, {
        method: 'webauthn',
        code: '123456',
        webauthnResponse: { id: 'credential-id' },
      }),
    ).toMatchObject({
      method: 'webauthn',
      code: '******',
      webauthnResponse: '******',
    });

    expect(
      maskWith(SamlCallbackDto, {
        SAMLResponse: 'base64-saml-response',
        RelayState: 'opaque-relay-state',
      }),
    ).toMatchObject({
      SAMLResponse: '******',
      RelayState: '******',
    });
  });
});
