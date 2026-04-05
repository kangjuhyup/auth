import { OAuth2IdpAdapter } from '@infrastructure/idp/oauth2-idp.adapter';

describe('OAuth2IdpAdapter', () => {
  let adapter: OAuth2IdpAdapter;

  beforeEach(() => {
    jest.restoreAllMocks();
    adapter = new OAuth2IdpAdapter();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAuthorizationUrl', () => {
    it('provider 기본 scope를 사용해 authorization url을 생성한다', () => {
      const rawUrl = adapter.getAuthorizationUrl(
        'google',
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
    });

    it('scopes가 주어지면 provider 기본 scope 대신 사용한다', () => {
      const rawUrl = adapter.getAuthorizationUrl(
        'google',
        'google-client',
        'https://app.example.com/callback',
        'state-123',
        ['openid', 'custom.read'],
      );
      const url = new URL(rawUrl);

      expect(url.searchParams.get('scope')).toBe('openid custom.read');
    });

    it('지원하지 않는 provider면 예외를 던진다', () => {
      expect(() =>
        adapter.getAuthorizationUrl(
          'unknown',
          'client',
          'https://app.example.com/callback',
          'state-123',
        ),
      ).toThrow('Unsupported IdP provider: unknown');
    });
  });

  describe('exchangeCode', () => {
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
        'google-client',
        'google-secret',
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
      expect(params.get('client_secret')).toBe('google-secret');

      expect(httpGet).toHaveBeenCalledWith(
        'https://openidconnect.googleapis.com/v1/userinfo',
        { Authorization: 'Bearer google-access-token' },
      );
      expect(result).toEqual({
        sub: 'google-user',
        email: 'user@example.com',
        profile,
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
        profile: {
          response: {
            id: 'naver-user',
            email: 'naver@example.com',
            nickname: 'Naver User',
          },
        },
      });
    });

    it('userinfo endpoint가 없는 provider는 id_token payload를 파싱한다', async () => {
      const payload = {
        sub: 'apple-user',
        email: 'apple@example.com',
        email_verified: true,
      };
      const idToken = [
        Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
        Buffer.from(JSON.stringify(payload)).toString('base64url'),
        'signature',
      ].join('.');
      const httpPost = jest
        .spyOn(adapter as any, 'httpPost')
        .mockResolvedValue({
          access_token: 'apple-access-token',
          id_token: idToken,
        });
      const httpGet = jest.spyOn(adapter as any, 'httpGet');

      const result = await adapter.exchangeCode(
        'apple',
        'apple-client',
        'apple-secret',
        'auth-code',
        'https://app.example.com/callback',
      );

      expect(httpPost).toHaveBeenCalledWith(
        'https://appleid.apple.com/auth/token',
        expect.any(String),
        { 'Content-Type': 'application/x-www-form-urlencoded' },
      );
      expect(httpGet).not.toHaveBeenCalled();
      expect(result).toEqual({
        sub: 'apple-user',
        email: 'apple@example.com',
        profile: payload,
      });
    });

    it('지원하지 않는 provider면 예외를 던진다', async () => {
      await expect(
        adapter.exchangeCode(
          'unknown',
          'client',
          null,
          'auth-code',
          'https://app.example.com/callback',
        ),
      ).rejects.toThrow('Unsupported IdP provider: unknown');
    });
  });
});
