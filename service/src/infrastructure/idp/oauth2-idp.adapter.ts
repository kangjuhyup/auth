import { Injectable } from '@nestjs/common';
import { IdpPort } from '@application/ports/idp.port';
import type { IdpUserInfo } from '@application/ports/idp.port';
import type { IdpOauthEndpointsConfig } from '@domain/models';
import { resolveIdpOauthEndpoints } from '@domain/models';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { URL } from 'node:url';
import { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';
import { unprotectIdpClientSecret } from '@application/services/idp-client-secret';

@Injectable()
export class OAuth2IdpAdapter implements IdpPort {
  constructor(private readonly symmetricCrypto: SymmetricCryptoPort) {}

  getAuthorizationUrl(
    provider: string,
    oauthConfig: IdpOauthEndpointsConfig | null,
    clientId: string,
    redirectUri: string,
    state: string,
    scopes?: string[],
  ): string {
    const endpoints = resolveIdpOauthEndpoints(provider, oauthConfig);
    const finalScopes = (scopes ?? endpoints.scopes).filter(
      (scope) => scope !== 'account_ci' && scope !== 'ci',
    );

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: finalScopes.join(' '),
    });
    if (endpoints.extraAuthParams) {
      for (const [k, v] of Object.entries(endpoints.extraAuthParams)) {
        if (
          [
            'response_type',
            'client_id',
            'redirect_uri',
            'state',
            'scope',
          ].includes(k)
        )
          throw new Error('Reserved IdP authorization parameter');
        params.set(k, v);
      }
    }

    return `${endpoints.authorization}?${params.toString()}`;
  }

  async exchangeCode(
    provider: string,
    oauthConfig: IdpOauthEndpointsConfig | null,
    clientId: string,
    clientSecretEnc: string | null,
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
    if (clientSecretEnc) {
      tokenBody.client_secret = unprotectIdpClientSecret(
        this.symmetricCrypto,
        clientSecretEnc,
      );
    }

    const tokenData = await this.httpPost(
      endpoints.token,
      new URLSearchParams(tokenBody).toString(),
      { 'Content-Type': 'application/x-www-form-urlencoded' },
    );
    const accessToken = tokenData.access_token;
    if (typeof accessToken !== 'string' || !accessToken)
      throw new Error('IdP token unavailable');

    if (!endpoints.userinfo) {
      throw new Error(
        'IdP userinfo endpoint required; unverified ID token is not authentication',
      );
    }

    const profile = await this.httpGet(endpoints.userinfo, {
      Authorization: `Bearer ${accessToken}`,
    });

    const rawSub = this.getNestedField(
      profile,
      provider === 'kakao' ? 'id' : endpoints.subField,
    );
    if (
      (typeof rawSub !== 'string' && typeof rawSub !== 'number') ||
      !String(rawSub) ||
      String(rawSub).length > 191 ||
      [...String(rawSub)].some((character) => character.charCodeAt(0) <= 32) ||
      !Number.isFinite(typeof rawSub === 'number' ? rawSub : 0)
    )
      throw new Error('IdP subject unavailable');
    if (provider === 'kakao' && !/^[1-9][0-9]{0,18}$/.test(String(rawSub)))
      throw new Error('IdP subject unavailable');
    if (typeof rawSub === 'number' && !Number.isSafeInteger(rawSub))
      throw new Error('IdP subject unavailable');
    const email = endpoints.emailField
      ? this.getNestedField(profile, endpoints.emailField)
      : undefined;
    const nickname = this.getNestedField(
      profile,
      provider === 'kakao' ? 'kakao_account.profile.nickname' : 'name',
    );
    return {
      sub: String(rawSub),
      email:
        typeof email === 'string' && email.length <= 191 ? email : undefined,
      profile:
        typeof nickname === 'string'
          ? { nickname: nickname.slice(0, 128) }
          : {},
    };
  }

  private getNestedField(obj: Record<string, unknown>, path: string): unknown {
    return path
      .split('.')
      .reduce<unknown>(
        (acc, key) =>
          acc && typeof acc === 'object'
            ? (acc as Record<string, unknown>)[key]
            : undefined,
        obj,
      );
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
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Length': Buffer.byteLength(body).toString(),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
            if (data.length > 1048576)
              req.destroy(new Error('IdP response too large'));
          });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              return reject(
                new Error(`IdP token exchange failed: ${res.statusCode}`),
              );
            }
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error('Invalid JSON response from IdP'));
            }
          });
        },
      );
      req.setTimeout(10000, () =>
        req.destroy(new Error('IdP request timeout')),
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
        res.on('data', (chunk) => {
          data += chunk;
          if (data.length > 1048576)
            req.destroy(new Error('IdP response too large'));
        });
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
      req.setTimeout(10000, () =>
        req.destroy(new Error('IdP request timeout')),
      );
      req.on('error', reject);
      req.end();
    });
  }
}
