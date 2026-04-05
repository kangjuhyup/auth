import { Injectable } from '@nestjs/common';
import { IdpPort } from '@application/ports/idp.port';
import type { IdpUserInfo } from '@application/ports/idp.port';
import type {
  IdpOauthEndpointsConfig,
  IdpOauthResolvedEndpoints,
} from '@domain/models';
import { resolveIdpOauthEndpoints } from '@domain/models';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { URL } from 'node:url';

@Injectable()
export class OAuth2IdpAdapter implements IdpPort {
  getAuthorizationUrl(
    provider: string,
    oauthConfig: IdpOauthEndpointsConfig | null,
    clientId: string,
    redirectUri: string,
    state: string,
    scopes?: string[],
  ): string {
    const endpoints = resolveIdpOauthEndpoints(provider, oauthConfig);
    const finalScopes = scopes ?? endpoints.scopes;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: finalScopes.join(' '),
    });
    if (endpoints.extraAuthParams) {
      for (const [k, v] of Object.entries(endpoints.extraAuthParams)) {
        params.set(k, v);
      }
    }

    return `${endpoints.authorization}?${params.toString()}`;
  }

  async exchangeCode(
    provider: string,
    oauthConfig: IdpOauthEndpointsConfig | null,
    clientId: string,
    clientSecret: string | null,
    code: string,
    redirectUri: string,
  ): Promise<IdpUserInfo> {
    const endpoints = resolveIdpOauthEndpoints(provider, oauthConfig);

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
    endpoints: IdpOauthResolvedEndpoints,
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
