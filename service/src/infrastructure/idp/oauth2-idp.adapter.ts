import { Injectable } from '@nestjs/common';
import { IdpPort } from '@application/ports/idp.port';
import type { IdpUserInfo } from '@application/ports/idp.port';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { URL } from 'node:url';

interface ProviderEndpoints {
  authorization: string;
  token: string;
  userinfo: string;
  scopes: string[];
  subField: string;
  emailField?: string;
}

const WELL_KNOWN_ENDPOINTS: Record<string, ProviderEndpoints> = {
  google: {
    authorization: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    userinfo: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: ['openid', 'email', 'profile'],
    subField: 'sub',
    emailField: 'email',
  },
  kakao: {
    authorization: 'https://kauth.kakao.com/oauth/authorize',
    token: 'https://kauth.kakao.com/oauth/token',
    userinfo: 'https://kapi.kakao.com/v2/user/me',
    scopes: ['openid', 'account_email', 'profile_nickname'],
    subField: 'id',
    emailField: 'kakao_account.email',
  },
  naver: {
    authorization: 'https://nid.naver.com/oauth2.0/authorize',
    token: 'https://nid.naver.com/oauth2.0/token',
    userinfo: 'https://openapi.naver.com/v1/nid/me',
    scopes: [],
    subField: 'response.id',
    emailField: 'response.email',
  },
  apple: {
    authorization: 'https://appleid.apple.com/auth/authorize',
    token: 'https://appleid.apple.com/auth/token',
    userinfo: '',
    scopes: ['name', 'email'],
    subField: 'sub',
    emailField: 'email',
  },
};

@Injectable()
export class OAuth2IdpAdapter implements IdpPort {
  getAuthorizationUrl(
    provider: string,
    clientId: string,
    redirectUri: string,
    state: string,
    scopes?: string[],
  ): string {
    const endpoints = this.getEndpoints(provider);
    const finalScopes = scopes ?? endpoints.scopes;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: finalScopes.join(' '),
    });

    return `${endpoints.authorization}?${params.toString()}`;
  }

  async exchangeCode(
    provider: string,
    clientId: string,
    clientSecret: string | null,
    code: string,
    redirectUri: string,
  ): Promise<IdpUserInfo> {
    const endpoints = this.getEndpoints(provider);

    const tokenBody: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
    };
    if (clientSecret) {
      tokenBody.client_secret = clientSecret;
    }

    const tokenData = await this.httpPost(
      endpoints.token,
      new URLSearchParams(tokenBody).toString(),
      { 'Content-Type': 'application/x-www-form-urlencoded' },
    );
    const accessToken = tokenData.access_token as string;

    if (!endpoints.userinfo) {
      return this.parseIdToken(tokenData.id_token as string, endpoints);
    }

    const profile = await this.httpGet(endpoints.userinfo, {
      Authorization: `Bearer ${accessToken}`,
    });

    return {
      sub: String(this.getNestedField(profile, endpoints.subField)),
      email: endpoints.emailField
        ? (this.getNestedField(profile, endpoints.emailField) as
            | string
            | undefined)
        : undefined,
      profile,
    };
  }

  private getEndpoints(provider: string): ProviderEndpoints {
    const endpoints = WELL_KNOWN_ENDPOINTS[provider];
    if (!endpoints) {
      throw new Error(`Unsupported IdP provider: ${provider}`);
    }
    return endpoints;
  }

  private getNestedField(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    return path
      .split('.')
      .reduce<unknown>(
        (acc, key) =>
          acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
        obj,
      );
  }

  private parseIdToken(
    idToken: string,
    endpoints: ProviderEndpoints,
  ): IdpUserInfo {
    const payload = JSON.parse(
      Buffer.from(idToken.split('.')[1], 'base64url').toString(),
    ) as Record<string, unknown>;

    return {
      sub: String(payload[endpoints.subField] ?? payload.sub),
      email: (payload[endpoints.emailField ?? 'email'] as string) ?? undefined,
      profile: payload,
    };
  }

  private httpPost(
    url: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const reqFn = parsed.protocol === 'https:' ? httpsRequest : httpRequest;
      const req = reqFn(
        parsed,
        { method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(body).toString() } },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              return reject(new Error(`IdP token exchange failed: ${res.statusCode}`));
            }
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error('Invalid JSON response from IdP'));
            }
          });
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  private httpGet(
    url: string,
    headers: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const reqFn = parsed.protocol === 'https:' ? httpsRequest : httpRequest;
      const req = reqFn(parsed, { method: 'GET', headers }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            return reject(new Error(`IdP userinfo failed: ${res.statusCode}`));
          }
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Invalid JSON response from IdP'));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }
}
