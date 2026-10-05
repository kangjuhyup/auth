import { OAuth2IdpAdapter } from '@infrastructure/idp/oauth2-idp.adapter';
import type { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';

describe('OAuth2IdpAdapter', () => {
  let adapter: OAuth2IdpAdapter;
  let crypto: jest.Mocked<SymmetricCryptoPort>;

  beforeEach(() => {
    jest.restoreAllMocks();
    crypto = {
      encrypt: jest.fn(),
      decrypt: jest.fn().mockReturnValue('secret'),
    };
    adapter = new OAuth2IdpAdapter(crypto);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAuthorizationUrl', () => {
    it('provider 기본 scope를 사용해 authorization url을 생성한다', () => {
      const rawUrl = adapter.getAuthorizationUrl(
        'google',
        null,
        'google-client',
        'https://app.example.com/callback',
        'state-123',
      );
      const url = new URL(rawUrl);

      expect(`${url.origin}${url.pathname}`).toBe(
        'https://accounts.google.com/o/oauth2/v2/auth',
      );
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('client_id')).toBe('google-client');
      expect(url.searchParams.get('redirect_uri')).toBe(
        'https://app.example.com/callback',
      );
      expect(url.searchParams.get('state')).toBe('state-123');
      expect(url.searchParams.get('scope')).toBe('openid email profile');
      expect(url.searchParams.get('prompt')).toBe('select_account');
    });

    it('scopes가 주어지면 provider 기본 scope 대신 사용한다', () => {
      const rawUrl = adapter.getAuthorizationUrl(
        'google',
        null,
        'google-client',
        'https://app.example.com/callback',
        'state-123',
        ['openid', 'custom.read'],
      );
      const url = new URL(rawUrl);

      expect(url.searchParams.get('scope')).toBe('openid custom.read');
    });

    it('well-known에 없고 oauth_config도 없으면 예외를 던진다', () => {
      expect(() =>
        adapter.getAuthorizationUrl(
          'unknown',
          null,
          'client',
          'https://app.example.com/callback',
          'state-123',
        ),
      ).toThrow(/oauth_config/);
    });

    it('well-known에 없어도 oauth_config가 있으면 authorization url을 만든다', () => {
      const rawUrl = adapter.getAuthorizationUrl(
        'custom-idp',
        {
          authorizationUrl: 'https://idp.example.com/oauth/authorize',
          tokenUrl: 'https://idp.example.com/oauth/token',
          userinfoUrl: 'https://idp.example.com/userinfo',
          scopes: ['openid'],
          subField: 'sub',
        },
        'cid',
        'https://app.example.com/cb',
        'st',
      );
      const url = new URL(rawUrl);
      expect(`${url.origin}${url.pathname}`).toBe(
        'https://idp.example.com/oauth/authorize',
      );
    });
  });

  describe('exchangeCode', () => {
    it('Kakao default login never requests CI or requires OIDC/email consent', () => {
      const url = new URL(
        adapter.getAuthorizationUrl(
          'kakao',
          { scopes: ['profile_nickname', 'account_ci'] },
          'client',
          'https://auth.example/callback',
          'state',
        ),
      );
      expect(url.searchParams.get('scope')).toBe('profile_nickname');
      const minimum = new URL(
        adapter.getAuthorizationUrl(
          'kakao',
          null,
          'client',
          'https://auth.example/callback',
          'state',
        ),
      );
      expect(minimum.searchParams.get('scope')).toBe('profile_nickname');
    });
    it('discards CI and raw Kakao profile while allowing missing email', async () => {
      jest
        .spyOn(adapter as any, 'httpPost')
        .mockResolvedValue({ access_token: 'token' });
      jest.spyOn(adapter as any, 'httpGet').mockResolvedValue({
        id: 123,
        kakao_account: { ci: 'sensitive', profile: { nickname: 'Member' } },
      });
      expect(
        await adapter.exchangeCode(
          'kakao',
          null,
          'client',
          'enc:v1:ciphertext',
          'code',
          'https://auth.example/callback',
        ),
      ).toEqual({
        sub: '123',
        email: undefined,
        profile: { nickname: 'Member' },
      });
    });
    it.each([
      undefined,
      null,
      {},
      'undefined',
      'null',
      0,
      Number.MAX_SAFE_INTEGER + 1,
    ])('rejects invalid Kakao id %s', async (id) => {
      jest
        .spyOn(adapter as any, 'httpPost')
        .mockResolvedValue({ access_token: 'token' });
      jest.spyOn(adapter as any, 'httpGet').mockResolvedValue({ id });
      await expect(
        adapter.exchangeCode(
          'kakao',
          null,
          'client',
          null,
          'code',
          'https://auth.example/callback',
        ),
      ).rejects.toThrow('subject unavailable');
    });
    it('extraAuthParams cannot override security state or redirect', () => {
      expect(() =>
        adapter.getAuthorizationUrl(
          'kakao',
          { extraAuthParams: { state: 'attacker' } },
          'client',
          'https://auth.example/callback',
          'state',
        ),
      ).toThrow('Reserved');
    });

    it('userinfo endpoint가 있는 provider는 access token으로 profile을 조회한다', async () => {
      const httpPost = jest
        .spyOn(adapter as any, 'httpPost')
        .mockResolvedValue({ access_token: 'google-access-token' });
      const profile = {
        sub: 'google-user',
        email: 'user@example.com',
        name: 'Google User',
      };
      const httpGet = jest
        .spyOn(adapter as any, 'httpGet')
        .mockResolvedValue(profile);

      const result = await adapter.exchangeCode(
        'google',
        null,
        'google-client',
        'enc:v1:ciphertext',
        'auth-code',
        'https://app.example.com/callback',
      );

      expect(httpPost).toHaveBeenCalledTimes(1);
      expect(httpPost).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.any(String),
        { 'Content-Type': 'application/x-www-form-urlencoded' },
      );

      const [, body] = httpPost.mock.calls[0] as [string, string];
      const params = new URLSearchParams(body);
      expect(params.get('grant_type')).toBe('authorization_code');
      expect(params.get('code')).toBe('auth-code');
      expect(params.get('redirect_uri')).toBe(
        'https://app.example.com/callback',
      );
      expect(params.get('client_id')).toBe('google-client');
      expect(params.get('client_secret')).toBe('secret');
      expect(crypto.decrypt).toHaveBeenCalledWith('ciphertext');

      expect(httpGet).toHaveBeenCalledWith(
        'https://openidconnect.googleapis.com/v1/userinfo',
        { Authorization: 'Bearer google-access-token' },
      );
      expect(result).toEqual({
        sub: 'google-user',
        email: 'user@example.com',
        profile: { nickname: 'Google User' },
      });
    });

    it('client secret이 없으면 token 요청에서 client_secret을 제외한다', async () => {
      const httpPost = jest
        .spyOn(adapter as any, 'httpPost')
        .mockResolvedValue({ access_token: 'naver-access-token' });
      const httpGet = jest.spyOn(adapter as any, 'httpGet').mockResolvedValue({
        response: {
          id: 'naver-user',
          email: 'naver@example.com',
          nickname: 'Naver User',
        },
      });

      const result = await adapter.exchangeCode(
        'naver',
        null,
        'naver-client',
        null,
        'auth-code',
        'https://app.example.com/callback',
      );

      const [, body] = httpPost.mock.calls[0] as [string, string];
      const params = new URLSearchParams(body);

      expect(params.has('client_secret')).toBe(false);
      expect(httpGet).toHaveBeenCalledWith(
        'https://openapi.naver.com/v1/nid/me',
        { Authorization: 'Bearer naver-access-token' },
      );
      expect(result).toEqual({
        sub: 'naver-user',
        email: 'naver@example.com',
        profile: {},
      });
    });

    it('userinfo 없는 공급자의 검증되지 않은 ID token으로 로그인하지 않는다', async () => {
      jest
        .spyOn(adapter as any, 'httpPost')
        .mockResolvedValue({ access_token: 'access', id_token: 'unsigned' });
      await expect(
        adapter.exchangeCode(
          'apple',
          null,
          'client',
          'enc:v1:ciphertext',
          'code',
          'https://auth.example/callback',
        ),
      ).rejects.toThrow('userinfo endpoint required');
    });

    it('평문 또는 손상된 client secret은 token endpoint로 전송하지 않는다', async () => {
      const httpPost = jest.spyOn(adapter as any, 'httpPost');

      await expect(
        adapter.exchangeCode(
          'kakao',
          null,
          'client',
          'legacy-plaintext',
          'code',
          'https://auth.example/callback',
        ),
      ).rejects.toThrow('IdP client secret is not protected');
      expect(httpPost).not.toHaveBeenCalled();
    });

    it('암호문 인증에 실패한 client secret도 token endpoint로 전송하지 않는다', async () => {
      const httpPost = jest.spyOn(adapter as any, 'httpPost');
      crypto.decrypt.mockImplementationOnce(() => {
        throw new Error('invalid authentication tag');
      });

      await expect(
        adapter.exchangeCode(
          'kakao',
          null,
          'client',
          'enc:v1:corrupted',
          'code',
          'https://auth.example/callback',
        ),
      ).rejects.toThrow('invalid authentication tag');
      expect(httpPost).not.toHaveBeenCalled();
    });

    it('well-known에 없고 oauth_config도 없으면 예외를 던진다', async () => {
      await expect(
        adapter.exchangeCode(
          'unknown',
          null,
          'client',
          null,
          'auth-code',
          'https://app.example.com/callback',
        ),
      ).rejects.toThrow(/oauth_config/);
    });
  });
});
