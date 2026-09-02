import { createHash, createHmac, createPublicKey, verify } from 'node:crypto';
import request from 'supertest';
import { ConsentModel } from '@domain/models/consent';
import { UserIdentityModel } from '@domain/models/user-identity';
import { RedisAdapter } from '@infrastructure/oidc-provider/adapters/redis-oidc.adapter';
import { RefreshTokenReuseStore } from '@infrastructure/oidc-provider/refresh-token-reuse.store';
import { EventRepositoryImpl } from '@infrastructure/repositories/event.repository.impl';
import { ApiE2eFixture, createApiE2eFixture } from './api-test-app';
import { cleanupE2eResources } from './e2e-cleanup';
import { MockOidcIdpServer } from './mock-oidc-idp';
import { MockRelyingPartyServer } from './mock-relying-party';

jest.setTimeout(180_000);

/**
 * 실제 PostgreSQL + Redis 기반 E2E 시나리오
 *
 * 1. 관리자 세션
 *    - 마이그레이션으로 시드된 master/admin 계정으로 로그인한다.
 *
 * 2. 관리자 관리 기능
 *    - 테넌트를 생성/조회/수정/삭제한다.
 *    - 특정 테넌트에 OIDC 클라이언트를 생성/조회/수정/삭제한다.
 *    - 특정 테넌트에 권한/롤/그룹을 생성/조회/수정/삭제한다.
 *    - 롤-권한, 그룹-롤 연결과 해제를 검증한다.
 *    - 테넌트 범위 Identity Provider(OIDC 소셜 설정)를 생성·목록·단건·수정·삭제한다.
 *    - 인증 실패, 입력 검증 실패, 중복 생성, 잘못된 관계 요청의 실패 응답을 검증한다.
 *
 * 3. 일반 유저 셀프서비스
 *    - 특정 테넌트에 회원가입한다.
 *    - 실제 OIDC authorize → interaction login → token 교환으로 로그인한다.
 *    - 발급된 access token으로 프로필 조회/수정/비밀번호 변경/회원탈퇴를 수행한다.
 *    - 동의 목록 조회와 철회를 수행한다.
 *    - 잘못된 로그인, PKCE 실패, tenant context 누락, 인증 누락, 잘못된 입력을 검증한다.
 */
export type ApiE2eSuiteGroup = 'health' | 'admin' | 'oidc' | 'user';

type ConsoleRestore = () => void;
type ConsoleMethod = 'debug' | 'error' | 'info' | 'log' | 'warn';

function suppressE2eConsole(): ConsoleRestore {
  if (process.env.E2E_SHOW_LOGS === 'true') {
    return () => undefined;
  }

  const spies = (
    ['debug', 'error', 'info', 'log', 'warn'] as ConsoleMethod[]
  ).map((method) => jest.spyOn(console, method).mockImplementation());

  return () => {
    for (const spy of spies) {
      spy.mockRestore();
    }
  };
}

function maybeDescribe(enabled: boolean): typeof describe {
  if (enabled) return describe;
  return (() => undefined) as unknown as typeof describe;
}

export function registerApiE2eSuite(groups: ApiE2eSuiteGroup[]): void {
  describe('API E2E', () => {
    const describeHealth = maybeDescribe(groups.includes('health'));
    const describeAdmin = maybeDescribe(groups.includes('admin'));
    const describeOidc = maybeDescribe(groups.includes('oidc'));
    const describeUser = maybeDescribe(groups.includes('user'));
    let fixture!: ApiE2eFixture;
    let mockIdp!: MockOidcIdpServer;
    let mockRelyingParty!: MockRelyingPartyServer;
    let restoreRelyingPartyFetch: (() => void) | undefined;
    let restoreConsole: ConsoleRestore | undefined;

    beforeAll(async () => {
      restoreConsole = suppressE2eConsole();
      mockIdp = await MockOidcIdpServer.start();
      mockRelyingParty = await MockRelyingPartyServer.start();
      restoreRelyingPartyFetch = mockRelyingParty.interceptFetch();
      fixture = await createApiE2eFixture();
    });

    beforeEach(async () => {
      mockIdp.reset();
      mockRelyingParty.reset();
      await fixture.resetPersistence();
    });

    afterAll(async () => {
      await cleanupE2eResources({
        closeTasks: [
          () => (fixture ? fixture.close() : Promise.resolve()),
          () => (mockIdp ? mockIdp.close() : Promise.resolve()),
          () =>
            mockRelyingParty ? mockRelyingParty.close() : Promise.resolve(),
        ],
        restorers: [
          () => restoreRelyingPartyFetch?.(),
          () => restoreConsole?.(),
        ],
      });
    });

    function buildPkce(): { verifier: string; challenge: string } {
      const verifier =
        'codex-e2e-code-verifier-1234567890-abcdefghijklmno-pqrstuv';
      const challenge = createHash('sha256')
        .update(verifier)
        .digest('base64url');

      return { verifier, challenge };
    }

    function decodeBase32(encoded: string): Buffer {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      const cleaned = encoded.replace(/=+$/, '').toUpperCase();
      let bits = '';

      for (const char of cleaned) {
        const value = alphabet.indexOf(char);
        if (value === -1) continue;
        bits += value.toString(2).padStart(5, '0');
      }

      const bytes: number[] = [];
      for (let index = 0; index + 8 <= bits.length; index += 8) {
        bytes.push(parseInt(bits.slice(index, index + 8), 2));
      }

      return Buffer.from(bytes);
    }

    function generateTotpCode(secret: string, now = Date.now()): string {
      const counter = Math.floor(now / 30000);
      const counterBuffer = Buffer.alloc(8);
      let value = counter;

      for (let index = 7; index >= 0; index -= 1) {
        counterBuffer[index] = value & 0xff;
        value = Math.floor(value / 256);
      }

      const hmac = createHmac('sha1', decodeBase32(secret) as unknown as string)
        .update(counterBuffer as unknown as string)
        .digest();
      const offset = hmac[hmac.length - 1] & 0xf;
      const code =
        (((hmac[offset] & 0x7f) << 24) |
          ((hmac[offset + 1] & 0xff) << 16) |
          ((hmac[offset + 2] & 0xff) << 8) |
          (hmac[offset + 3] & 0xff)) %
        1000000;

      return code.toString().padStart(6, '0');
    }

    function buildInvalidTotpCode(validCode: string): string {
      return validCode === '000000' ? '000001' : '000000';
    }

    function toAppPath(urlOrPath: string): string {
      if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
        const url = new URL(urlOrPath);
        return `${url.pathname}${url.search}`;
      }

      return urlOrPath;
    }

    async function loginAsAdmin(): Promise<string> {
      const response = await request(fixture.app.getHttpServer())
        .post('/admin/session')
        .send({
          username: fixture.env.adminUsername,
          password: fixture.env.adminPassword,
        })
        .expect(201);

      expect(response.body).toEqual({
        username: fixture.env.adminUsername,
        passwordChangeRequired: false,
      });

      const setCookie = response.headers['set-cookie'];
      const adminSessionCookie = (
        Array.isArray(setCookie) ? setCookie : [setCookie]
      ).find((cookie): cookie is string => {
        return (
          typeof cookie === 'string' && cookie.startsWith('admin_session=')
        );
      });
      expect(adminSessionCookie).toBeDefined();

      return decodeURIComponent(
        adminSessionCookie!.split(';')[0]!.replace('admin_session=', ''),
      );
    }

    async function createTenant(
      adminToken: string,
      tenantCode = 'acme',
      tenantName = 'Acme Corp',
    ): Promise<{ id: string; code: string }> {
      const response = await request(fixture.app.getHttpServer())
        .post('/admin/tenants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: tenantCode,
          name: tenantName,
        })
        .expect(201);

      return {
        id: response.body.id as string,
        code: tenantCode,
      };
    }

    async function createClient(
      adminToken: string,
      tenantCode: string,
      clientId = 'acme-web',
      overrides?: {
        name?: string;
        type?: 'public' | 'confidential' | 'service';
        secret?: string;
        redirectUris?: string[];
        grantTypes?: string[];
        responseTypes?: string[];
        tokenEndpointAuthMethod?: string;
        scope?: string;
        postLogoutRedirectUris?: string[];
        applicationType?: 'web' | 'native';
        allowedResources?: string[];
        introspectionResources?: string[];
        skipConsent?: boolean;
        backchannelLogoutUri?: string;
      },
    ): Promise<{
      id: string;
      clientId: string;
      redirectUri: string;
      redirectUris: string[];
      secret?: string;
    }> {
      const redirectUri =
        overrides?.redirectUris?.[0] ??
        `https://${tenantCode}.example.test/callback`;
      const clientPayload = {
        clientId,
        name: overrides?.name ?? `${tenantCode} web`,
        type: overrides?.type ?? 'public',
        secret: overrides?.secret,
        redirectUris: overrides?.redirectUris ?? [redirectUri],
        grantTypes: overrides?.grantTypes ?? ['authorization_code'],
        responseTypes: overrides?.responseTypes ?? ['code'],
        tokenEndpointAuthMethod: overrides?.tokenEndpointAuthMethod ?? 'none',
        scope: overrides?.scope ?? 'openid profile email',
        postLogoutRedirectUris: overrides?.postLogoutRedirectUris ?? [
          `https://${tenantCode}.example.test/logout`,
        ],
        applicationType: overrides?.applicationType ?? 'web',
        allowedResources: overrides?.allowedResources ?? [
          'https://resource.example.test',
        ],
        introspectionResources: overrides?.introspectionResources ?? [],
        skipConsent: overrides?.skipConsent ?? true,
        backchannelLogoutUri: overrides?.backchannelLogoutUri,
      };

      const response = await request(fixture.app.getHttpServer())
        .post(`/t/${tenantCode}/admin/clients`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(clientPayload)
        .expect(201);

      return {
        id: response.body.id as string,
        clientId,
        redirectUri,
        redirectUris: clientPayload.redirectUris,
        secret: overrides?.secret,
      };
    }

    async function createPermission(
      adminToken: string,
      tenantCode: string,
      code = 'users:read',
    ): Promise<{ id: string; code: string }> {
      const response = await request(fixture.app.getHttpServer())
        .post(`/t/${tenantCode}/admin/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code,
          resource: 'users',
          action: 'read',
          description: `${code} permission`,
        })
        .expect(201);

      return {
        id: response.body.id as string,
        code,
      };
    }

    async function createRole(
      adminToken: string,
      tenantCode: string,
      code = 'tenant_admin',
    ): Promise<{ id: string; code: string }> {
      const response = await request(fixture.app.getHttpServer())
        .post(`/t/${tenantCode}/admin/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code,
          name: `${code} role`,
          description: `${code} description`,
        })
        .expect(201);

      return {
        id: response.body.id as string,
        code,
      };
    }

    async function createGroup(
      adminToken: string,
      tenantCode: string,
      code = 'ops',
      params?: { parentId?: string },
    ): Promise<{ id: string; code: string }> {
      const response = await request(fixture.app.getHttpServer())
        .post(`/t/${tenantCode}/admin/groups`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code,
          name: `${code} group`,
          parentId: params?.parentId,
        })
        .expect(201);

      return {
        id: response.body.id as string,
        code,
      };
    }

    async function signupUser(
      tenantCode: string,
      params?: {
        username?: string;
        password?: string;
        email?: string;
        phone?: string;
      },
    ): Promise<{ userId: string; username: string; password: string }> {
      const username = params?.username ?? 'alice';
      const password = params?.password ?? 'Password123!';

      const response = await request(fixture.app.getHttpServer())
        .post('/auth/signup')
        .query({ tenantCode })
        .send({
          username,
          password,
          email: params?.email ?? `${username}@${tenantCode}.test`,
          phone: params?.phone,
        })
        .expect(201);

      return {
        userId: response.body.userId as string,
        username,
        password,
      };
    }

    async function beginOidcInteraction(params: {
      tenantCode: string;
      clientId: string;
      redirectUri: string;
      resource?: string;
      scope?: string;
      prompt?: string;
    }) {
      const agent = request.agent(fixture.app.getHttpServer());
      const { verifier, challenge } = buildPkce();

      const authorizeResponse = await agent
        .get(`/t/${params.tenantCode}/oidc/auth`)
        .query({
          client_id: params.clientId,
          redirect_uri: params.redirectUri,
          response_type: 'code',
          scope: params.scope ?? 'openid profile email',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          nonce: 'nonce-1234',
          state: 'state-1234',
          ...(params.resource ? { resource: params.resource } : {}),
          ...(params.prompt ? { prompt: params.prompt } : {}),
        })
        .expect((response) => {
          expect([302, 303]).toContain(response.status);
        });

      const interactionLocation = authorizeResponse.headers.location as string;
      const uid = /\/t\/[^/]+\/interaction\/([^/?]+)/.exec(
        interactionLocation,
      )?.[1];

      expect(uid).toBeDefined();

      const detailsResponse = await agent
        .get(`/t/${params.tenantCode}/interaction/${uid}/api/details`)
        .expect(200);

      expect(detailsResponse.body).toMatchObject({
        uid,
        prompt: 'login',
        clientId: params.clientId,
      });

      return {
        agent,
        uid: uid as string,
        verifier,
      };
    }

    async function authorizeUserViaOidc(params: {
      tenantCode: string;
      clientId: string;
      redirectUri: string;
      username: string;
      password: string;
      resource?: string;
      scope?: string;
      prompt?: string;
    }) {
      const { agent, uid, verifier } = await beginOidcInteraction(params);

      const loginResponse = await agent
        .post(`/t/${params.tenantCode}/interaction/${uid}/api/login`)
        .send({
          username: params.username,
          password: params.password,
        })
        .expect(200);

      expect(loginResponse.body).toMatchObject({
        success: true,
        mfaRequired: false,
        redirectTo: expect.any(String),
      });

      const code = await resolveAuthorizationCode(
        agent,
        loginResponse.body.redirectTo,
      );

      return {
        agent,
        code: code as string,
        verifier,
        uid,
      };
    }

    async function resolveAuthorizationCode(
      agent: ReturnType<typeof request.agent>,
      redirectTo: string,
      remainingConsentSteps = 2,
    ): Promise<string> {
      const resumeResponse = await agent
        .get(toAppPath(redirectTo))
        .set('Accept', 'application/json')
        .expect((response) => {
          if (![302, 303].includes(response.status)) {
            const error = response.body as {
              error?: string;
              error_description?: string;
            };
            throw new Error(
              `OIDC resume failed (${response.status}): ${error.error ?? 'unknown_error'} ${error.error_description ?? ''}`,
            );
          }
        });

      const location = resumeResponse.headers.location as string;
      const callbackLocation = new URL(location, 'http://127.0.0.1');
      const code = callbackLocation.searchParams.get('code');

      if (code) return code;

      const interactionPath = /^(\/t\/[^/]+\/interaction\/[^/?]+)/.exec(
        callbackLocation.pathname,
      )?.[1];
      expect(interactionPath).toBeDefined();
      expect(remainingConsentSteps).toBeGreaterThan(0);

      const detailsResponse = await agent
        .get(`${interactionPath}/api/details`)
        .expect(200);
      expect(detailsResponse.body.prompt).toBe('consent');

      const consentResponse = await agent
        .post(`${interactionPath}/api/consent`)
        .expect(201);
      expect(consentResponse.body).toMatchObject({
        success: true,
        redirectTo: expect.any(String),
      });

      return resolveAuthorizationCode(
        agent,
        consentResponse.body.redirectTo as string,
        remainingConsentSteps - 1,
      );
    }

    async function loginUserViaOidc(params: {
      tenantCode: string;
      clientId: string;
      redirectUri: string;
      username: string;
      password: string;
      resource?: string;
      scope?: string;
      prompt?: string;
    }): Promise<{ accessToken: string; refreshToken?: string }> {
      const { agent, code, verifier } = await authorizeUserViaOidc(params);

      const tokenResponse = await agent
        .post(`/t/${params.tenantCode}/oidc/token`)
        .type('form')
        .send({
          grant_type: 'authorization_code',
          client_id: params.clientId,
          redirect_uri: params.redirectUri,
          code,
          code_verifier: verifier,
          ...(params.resource ? { resource: params.resource } : {}),
        })
        .expect(200);

      expect(tokenResponse.body.access_token).toEqual(expect.any(String));

      return {
        accessToken: tokenResponse.body.access_token as string,
        refreshToken: tokenResponse.body.refresh_token as string | undefined,
      };
    }

    function exchangeAuthorizationCode(params: {
      agent: ReturnType<typeof request.agent>;
      tenantCode: string;
      clientId: string;
      redirectUri: string;
      code: string;
      codeVerifier: string;
      clientSecret?: string;
      resource?: string;
      scope?: string;
    }) {
      return params.agent
        .post(`/t/${params.tenantCode}/oidc/token`)
        .type('form')
        .send({
          grant_type: 'authorization_code',
          client_id: params.clientId,
          client_secret: params.clientSecret,
          redirect_uri: params.redirectUri,
          code: params.code,
          code_verifier: params.codeVerifier,
          ...(params.resource ? { resource: params.resource } : {}),
        });
    }

    function introspectToken(params: {
      tenantCode: string;
      clientId?: string;
      clientSecret?: string;
      token: string;
      tokenTypeHint?: string;
    }) {
      let call = request(fixture.app.getHttpServer())
        .post(`/t/${params.tenantCode}/oidc/token/introspection`)
        .type('form')
        .send({
          token: params.token,
          token_type_hint: params.tokenTypeHint,
          ...(params.clientId && params.clientSecret === undefined
            ? { client_id: params.clientId }
            : {}),
        });
      if (params.clientId && params.clientSecret !== undefined) {
        call = call.auth(params.clientId, params.clientSecret, {
          type: 'basic',
        });
      }
      return call;
    }

    async function waitForInvalidClientAudit(params: {
      tenantId: string;
      clientId: string | null;
      publicClientId: string;
      excludedEventIds?: readonly string[];
    }) {
      const repository = new EventRepositoryImpl(fixture.orm.em);
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const events = await fixture.runInRequestContext(() =>
          repository.list({
            tenantId: params.tenantId,
            page: 1,
            limit: 50,
            action: 'ACCESS_DENIED',
          }),
        );
        const event = events.items.find(
          (candidate) =>
            candidate.reason === 'InvalidClient' &&
            candidate.clientId === params.clientId &&
            candidate.resourceId === params.publicClientId &&
            !params.excludedEventIds?.includes(candidate.id!),
        );
        if (event) return event;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error('Expected invalid_client audit event was not persisted');
    }

    async function waitForRefreshTokenReuseAudit(tenantId: string) {
      const repository = new EventRepositoryImpl(fixture.orm.em);
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const events = await fixture.runInRequestContext(() =>
          repository.list({
            tenantId,
            page: 1,
            limit: 50,
            action: 'TOKEN_REVOKED',
          }),
        );
        const event = events.items.find(
          (candidate) => candidate.reason === 'RefreshTokenReuseDetected',
        );
        if (event) return event;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error('Expected refresh token reuse audit event');
    }

    async function waitForRefreshTokenFamilyRemoval(
      tenantId: string,
      grantId: string,
    ): Promise<void> {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const [row] = await fixture.orm.em
          .getConnection()
          .execute<
            Array<{ count: string }>
          >(`select count(*) as "count" from "oidc_model" where "tenant_id" = ? and ("grant_id" = ? or ("kind" = 'Grant' and "id" = ?))`, [tenantId, grantId, grantId]);
        const redisKeys = await fixture.redis.keys(
          `oidc:${tenantId}:*:grant:${grantId}`,
        );
        const activeRedisKeys = redisKeys.filter(
          (key) => !key.includes(':reuse-conflict:grant:'),
        );
        if (Number(row.count) === 0 && activeRedisKeys.length === 0) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error('Expected refresh token family to be removed');
    }

    async function revokeAccessToken(
      tenantCode: string,
      tokenValue: string,
    ): Promise<void> {
      await fixture.runInRequestContext(async () => {
        const provider = await fixture.registry.get(tenantCode);
        const token = await provider.AccessToken.find(tokenValue);
        expect(token).toBeDefined();
        await token!.destroy();
      });
    }

    async function enrollTotp(params: {
      tenantCode: string;
      accessToken: string;
    }): Promise<{ secret: string; recoveryCodes: string[] }> {
      const enrollResponse = await request(fixture.app.getHttpServer())
        .post('/auth/mfa/totp/enroll')
        .query({ tenantCode: params.tenantCode })
        .set('Authorization', `Bearer ${params.accessToken}`)
        .expect(201);

      expect(enrollResponse.body).toMatchObject({
        secret: expect.any(String),
        otpauthUrl: expect.stringContaining('otpauth://totp/'),
      });

      const secret = enrollResponse.body.secret as string;
      const confirmResponse = await request(fixture.app.getHttpServer())
        .post('/auth/mfa/totp/confirm')
        .query({ tenantCode: params.tenantCode })
        .set('Authorization', `Bearer ${params.accessToken}`)
        .send({ code: generateTotpCode(secret) })
        .expect(201);

      expect(confirmResponse.body.recoveryCodes).toHaveLength(10);

      return {
        secret,
        recoveryCodes: confirmResponse.body.recoveryCodes as string[],
      };
    }

    async function createMockOidcIdentityProvider(params: {
      adminToken: string;
      tenantCode: string;
      provider?: string;
    }): Promise<void> {
      await request(fixture.app.getHttpServer())
        .post(`/t/${params.tenantCode}/admin/identity-providers`)
        .set('Authorization', `Bearer ${params.adminToken}`)
        .send({
          provider: params.provider ?? 'mock_oidc',
          displayName: 'Mock OIDC',
          clientId: mockIdp.clientId,
          clientSecret: mockIdp.clientSecret,
          redirectUri: `${mockIdp.origin}/callback-placeholder`,
          enabled: true,
          oauthConfig: {
            authorizationUrl: `${mockIdp.origin}/authorize`,
            tokenUrl: `${mockIdp.origin}/token`,
            userinfoUrl: `${mockIdp.origin}/userinfo`,
            scopes: ['openid', 'email'],
            subField: 'sub',
            emailField: 'email',
          },
        })
        .expect(201);
    }

    async function linkUserIdentity(params: {
      tenantId: string;
      userId: string;
      provider: string;
      providerSub: string;
      email?: string;
    }): Promise<void> {
      await fixture.runInRequestContext(async () => {
        await fixture.userIdentityRepository.save(
          new UserIdentityModel({
            tenantId: params.tenantId,
            userId: params.userId,
            provider: params.provider,
            providerSub: params.providerSub,
            email: params.email,
            profileJson: params.email ? { email: params.email } : null,
            linkedAt: new Date(),
          }),
        );
      });
    }

    async function fetchMockIdpRedirect(authorizationUrl: URL): Promise<URL> {
      const nodeFetch = (
        globalThis as unknown as {
          fetch(
            input: URL,
            init: { redirect: 'manual' },
          ): Promise<{
            status: number;
            headers: { get(name: string): string | null };
          }>;
        }
      ).fetch;
      const response = await nodeFetch(authorizationUrl, {
        redirect: 'manual',
      });
      expect(response.status).toBe(302);

      const location = response.headers.get('location');
      expect(location).toBeTruthy();

      return new URL(location as string);
    }

    describeHealth('헬스 체크', () => {
      it('헬스 체크 요청 시 서비스 상태를 반환한다', async () => {
        const response = await request(fixture.app.getHttpServer())
          .get('/health')
          .expect(200);

        expect(response.body).toMatchObject({
          status: 'ok',
          uptimeSec: expect.any(Number),
        });
      });
    });

    describeAdmin('관리자 시나리오', () => {
      it('시드된 관리자 계정으로 로그인할 수 있다', async () => {
        const token = await loginAsAdmin();

        await request(fixture.app.getHttpServer())
          .delete('/admin/session')
          .set('Authorization', `Bearer ${token}`)
          .expect(204);
      });

      it('테넌트를 생성하고 조회하고 수정한 뒤 삭제할 수 있다', async () => {
        const adminToken = await loginAsAdmin();
        const tenant = await createTenant(adminToken, 'zenith', 'Zenith Labs');

        const getResponse = await request(fixture.app.getHttpServer())
          .get(`/admin/tenants/${tenant.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(getResponse.body).toMatchObject({
          id: tenant.id,
          code: 'zenith',
          name: 'Zenith Labs',
        });

        await request(fixture.app.getHttpServer())
          .put(`/admin/tenants/${tenant.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Zenith Labs Updated',
          })
          .expect(200);

        const updatedResponse = await request(fixture.app.getHttpServer())
          .get(`/admin/tenants/${tenant.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(updatedResponse.body).toMatchObject({
          id: tenant.id,
          code: 'zenith',
          name: 'Zenith Labs Updated',
        });

        await request(fixture.app.getHttpServer())
          .delete(`/admin/tenants/${tenant.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const listResponse = await request(fixture.app.getHttpServer())
          .get('/admin/tenants?page=1&limit=20')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(listResponse.body.items).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: 'zenith',
            }),
          ]),
        );
      });

      it('테넌트 범위에서 클라이언트를 생성하고 조회하고 수정한 뒤 삭제할 수 있다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const client = await createClient(adminToken, 'acme', 'acme-web');

        const getResponse = await request(fixture.app.getHttpServer())
          .get(`/t/acme/admin/clients/${client.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(getResponse.body).toMatchObject({
          id: client.id,
          clientId: 'acme-web',
          name: 'acme web',
          enabled: true,
        });

        await request(fixture.app.getHttpServer())
          .put(`/t/acme/admin/clients/${client.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Acme Web Updated',
            enabled: false,
            allowedResources: ['https://resource-updated.example.test'],
          })
          .expect(200);

        const updatedResponse = await request(fixture.app.getHttpServer())
          .get(`/t/acme/admin/clients/${client.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(updatedResponse.body).toMatchObject({
          id: client.id,
          clientId: 'acme-web',
          name: 'Acme Web Updated',
          enabled: false,
          allowedResources: ['https://resource-updated.example.test'],
        });

        await request(fixture.app.getHttpServer())
          .delete(`/t/acme/admin/clients/${client.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const listResponse = await request(fixture.app.getHttpServer())
          .get('/t/acme/admin/clients?page=1&limit=20')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(listResponse.body.items).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: client.id,
            }),
          ]),
        );
      });

      it('테넌트 범위에서 권한을 생성하고 조회하고 수정한 뒤 삭제할 수 있다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const permission = await createPermission(
          adminToken,
          'acme',
          'users:read',
        );

        const getResponse = await request(fixture.app.getHttpServer())
          .get(`/t/acme/admin/permissions/${permission.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(getResponse.body).toMatchObject({
          id: permission.id,
          code: 'users:read',
          resource: 'users',
          action: 'read',
        });

        await request(fixture.app.getHttpServer())
          .put(`/t/acme/admin/permissions/${permission.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            action: 'list',
            description: 'users list permission',
          })
          .expect(200);

        const updatedResponse = await request(fixture.app.getHttpServer())
          .get(`/t/acme/admin/permissions/${permission.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(updatedResponse.body).toMatchObject({
          id: permission.id,
          code: 'users:read',
          action: 'list',
          description: 'users list permission',
        });

        await request(fixture.app.getHttpServer())
          .delete(`/t/acme/admin/permissions/${permission.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        await request(fixture.app.getHttpServer())
          .get(`/t/acme/admin/permissions/${permission.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });

      it('테넌트 범위에서 롤을 생성하고 권한을 연결하고 해제한 뒤 삭제할 수 있다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const permission = await createPermission(
          adminToken,
          'acme',
          'users:manage',
        );
        const role = await createRole(adminToken, 'acme', 'tenant_admin');

        const getResponse = await request(fixture.app.getHttpServer())
          .get(`/t/acme/admin/roles/${role.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(getResponse.body).toMatchObject({
          id: role.id,
          code: 'tenant_admin',
          name: 'tenant_admin role',
        });

        await request(fixture.app.getHttpServer())
          .put(`/t/acme/admin/roles/${role.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Tenant Admin Updated',
            description: 'updated tenant admin role',
          })
          .expect(200);

        const updatedResponse = await request(fixture.app.getHttpServer())
          .get(`/t/acme/admin/roles/${role.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(updatedResponse.body).toMatchObject({
          id: role.id,
          name: 'Tenant Admin Updated',
          description: 'updated tenant admin role',
        });

        await request(fixture.app.getHttpServer())
          .post(`/t/acme/admin/roles/${role.id}/permissions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            permissionId: permission.id,
          })
          .expect(204);

        const permissionsResponse = await request(fixture.app.getHttpServer())
          .get(`/t/acme/admin/roles/${role.id}/permissions?page=1&limit=20`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(permissionsResponse.body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: permission.id,
              code: 'users:manage',
            }),
          ]),
        );

        await request(fixture.app.getHttpServer())
          .delete(`/t/acme/admin/roles/${role.id}/permissions/${permission.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(204);

        const afterRemoveResponse = await request(fixture.app.getHttpServer())
          .get(`/t/acme/admin/roles/${role.id}/permissions?page=1&limit=20`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(afterRemoveResponse.body.items).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: permission.id,
            }),
          ]),
        );

        await request(fixture.app.getHttpServer())
          .delete(`/t/acme/admin/roles/${role.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        await request(fixture.app.getHttpServer())
          .get(`/t/acme/admin/roles/${role.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });

      it('테넌트 범위에서 그룹을 생성하고 롤을 연결하고 해제한 뒤 삭제할 수 있다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const role = await createRole(adminToken, 'acme', 'ops_admin');
        const parentGroup = await createGroup(adminToken, 'acme', 'platform');
        const childGroup = await createGroup(adminToken, 'acme', 'ops', {
          parentId: parentGroup.id,
        });

        const getResponse = await request(fixture.app.getHttpServer())
          .get(`/t/acme/admin/groups/${childGroup.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(getResponse.body).toMatchObject({
          id: childGroup.id,
          code: 'ops',
          name: 'ops group',
          parentId: parentGroup.id,
        });

        await request(fixture.app.getHttpServer())
          .put(`/t/acme/admin/groups/${childGroup.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Operations Group Updated',
            parentId: null,
          })
          .expect(200);

        const updatedResponse = await request(fixture.app.getHttpServer())
          .get(`/t/acme/admin/groups/${childGroup.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(updatedResponse.body).toMatchObject({
          id: childGroup.id,
          name: 'Operations Group Updated',
          parentId: null,
        });

        await request(fixture.app.getHttpServer())
          .post(`/t/acme/admin/groups/${childGroup.id}/roles/${role.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(201);

        const rolesResponse = await request(fixture.app.getHttpServer())
          .get(`/t/acme/admin/groups/${childGroup.id}/roles`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(rolesResponse.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: role.id,
              code: 'ops_admin',
            }),
          ]),
        );

        await request(fixture.app.getHttpServer())
          .delete(`/t/acme/admin/groups/${childGroup.id}/roles/${role.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const afterRemoveResponse = await request(fixture.app.getHttpServer())
          .get(`/t/acme/admin/groups/${childGroup.id}/roles`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(afterRemoveResponse.body).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: role.id,
            }),
          ]),
        );

        await request(fixture.app.getHttpServer())
          .delete(`/t/acme/admin/groups/${childGroup.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(204);

        await request(fixture.app.getHttpServer())
          .get(`/t/acme/admin/groups/${childGroup.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });

      it('관리자 API는 인증과 입력 검증 실패를 올바른 상태 코드로 반환한다', async () => {
        await request(fixture.app.getHttpServer())
          .post('/admin/session')
          .send({
            username: fixture.env.adminUsername,
            password: 'WrongPassword123!',
          })
          .expect(401);

        await request(fixture.app.getHttpServer())
          .post('/admin/tenants')
          .send({
            code: 'blocked',
            name: 'Blocked Tenant',
          })
          .expect(403);

        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');

        await request(fixture.app.getHttpServer())
          .get('/admin/tenants?page=0&limit=101')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        await request(fixture.app.getHttpServer())
          .post('/admin/tenants')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            code: 'INVALID_CODE',
            name: 'Invalid Tenant',
          })
          .expect(400);

        await request(fixture.app.getHttpServer())
          .post('/t/acme/admin/permissions')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            code: 'invalid permission code',
            resource: 'users',
            action: 'read',
          })
          .expect(400);
      });

      it('관리자 API는 중복 생성과 잘못된 관계 요청에 대해 409와 404를 반환한다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        await createClient(adminToken, 'acme', 'acme-web');
        const permission = await createPermission(
          adminToken,
          'acme',
          'users:write',
        );
        const anotherPermission = await createPermission(
          adminToken,
          'acme',
          'users:delete',
        );
        const role = await createRole(adminToken, 'acme', 'operator');
        await createGroup(adminToken, 'acme', 'ops');

        await request(fixture.app.getHttpServer())
          .post('/admin/tenants')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            code: 'acme',
            name: 'Acme Duplicate',
          })
          .expect(409);

        await request(fixture.app.getHttpServer())
          .post('/t/acme/admin/clients')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            clientId: 'acme-web',
            name: 'acme duplicate',
            type: 'public',
            redirectUris: ['https://acme.example.test/callback'],
            grantTypes: ['authorization_code'],
            responseTypes: ['code'],
            tokenEndpointAuthMethod: 'none',
            scope: 'openid profile email',
            postLogoutRedirectUris: ['https://acme.example.test/logout'],
            applicationType: 'web',
            allowedResources: ['https://resource.example.test'],
          })
          .expect(409);

        await request(fixture.app.getHttpServer())
          .post('/t/acme/admin/permissions')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            code: 'users:write',
            resource: 'users',
            action: 'write',
          })
          .expect(409);

        await request(fixture.app.getHttpServer())
          .post('/t/acme/admin/roles')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            code: 'operator',
            name: 'operator role duplicate',
          })
          .expect(409);

        await request(fixture.app.getHttpServer())
          .post('/t/acme/admin/groups')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            code: 'ops',
            name: 'ops duplicate',
          })
          .expect(409);

        await request(fixture.app.getHttpServer())
          .post(`/t/acme/admin/roles/${role.id}/permissions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            permissionId: permission.id,
          })
          .expect(204);

        await request(fixture.app.getHttpServer())
          .post(`/t/acme/admin/roles/${role.id}/permissions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            permissionId: permission.id,
          })
          .expect(409);

        await request(fixture.app.getHttpServer())
          .delete(
            `/t/acme/admin/roles/${role.id}/permissions/${anotherPermission.id}`,
          )
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);

        await request(fixture.app.getHttpServer())
          .get('/t/acme/admin/roles/99999999')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);

        await request(fixture.app.getHttpServer())
          .get('/t/acme/admin/groups/99999999')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });

      it('테넌트 범위에서 Identity Provider를 생성·목록·단건 조회·수정·삭제할 수 있다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');

        const createResponse = await request(fixture.app.getHttpServer())
          .post('/t/acme/admin/identity-providers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            provider: 'kakao',
            displayName: 'Kakao Login',
            clientId: 'kakao-e2e-client',
            clientSecret: 'kakao-secret',
            redirectUri: 'https://acme.example.test/callback/kakao',
            enabled: true,
          })
          .expect(201);

        const idpId = createResponse.body.id as string;
        expect(idpId).toEqual(expect.any(String));

        const listResponse = await request(fixture.app.getHttpServer())
          .get('/t/acme/admin/identity-providers?page=1&limit=20')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(listResponse.body.items).toHaveLength(1);
        expect(listResponse.body.total).toBe(1);
        expect(listResponse.body.items[0]).toMatchObject({
          id: idpId,
          provider: 'kakao',
          displayName: 'Kakao Login',
          clientId: 'kakao-e2e-client',
          clientSecretSet: true,
          redirectUri: 'https://acme.example.test/callback/kakao',
          enabled: true,
        });
        expect(listResponse.body.items[0].oauthConfig).toBeNull();

        const getResponse = await request(fixture.app.getHttpServer())
          .get(`/t/acme/admin/identity-providers/${idpId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(getResponse.body).toMatchObject({
          id: idpId,
          provider: 'kakao',
          displayName: 'Kakao Login',
        });

        await request(fixture.app.getHttpServer())
          .put(`/t/acme/admin/identity-providers/${idpId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            displayName: 'Kakao Updated',
            enabled: false,
            oauthConfig: {
              tokenUrl: 'https://kauth.kakao.com/oauth/token',
              subField: 'id',
            },
          })
          .expect(200);

        const afterUpdate = await request(fixture.app.getHttpServer())
          .get(`/t/acme/admin/identity-providers/${idpId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(afterUpdate.body).toMatchObject({
          displayName: 'Kakao Updated',
          enabled: false,
        });
        expect(afterUpdate.body.oauthConfig).toMatchObject({
          tokenUrl: 'https://kauth.kakao.com/oauth/token',
          subField: 'id',
        });

        await request(fixture.app.getHttpServer())
          .delete(`/t/acme/admin/identity-providers/${idpId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        await request(fixture.app.getHttpServer())
          .get(`/t/acme/admin/identity-providers/${idpId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);

        const emptyList = await request(fixture.app.getHttpServer())
          .get('/t/acme/admin/identity-providers?page=1&limit=20')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(emptyList.body.items).toHaveLength(0);
      });

      it('Identity Provider는 동일 provider 중복 생성 시 409를 반환한다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');

        const payload = {
          provider: 'naver',
          displayName: 'Naver',
          clientId: 'naver-e2e',
          clientSecret: 'secret',
          redirectUri: 'https://acme.example.test/callback/naver',
        };

        await request(fixture.app.getHttpServer())
          .post('/t/acme/admin/identity-providers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(payload)
          .expect(201);

        await request(fixture.app.getHttpServer())
          .post('/t/acme/admin/identity-providers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            ...payload,
            displayName: 'Naver Duplicate',
          })
          .expect(409);
      });

      it('Identity Provider는 없는 id 404, 미인증 403, 잘못된 provider slug 400을 반환한다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');

        // id는 PostgreSQL bigint 범위 안이어야 한다(초과 시 DB/ORM에서 500).
        await request(fixture.app.getHttpServer())
          .get('/t/acme/admin/identity-providers/99999999')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);

        await request(fixture.app.getHttpServer())
          .post('/t/acme/admin/identity-providers')
          .send({
            provider: 'apple',
            displayName: 'Apple',
            clientId: 'apple-e2e',
            redirectUri: 'https://acme.example.test/callback/apple',
          })
          .expect(403);

        await request(fixture.app.getHttpServer())
          .post('/t/acme/admin/identity-providers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            provider: '-bad-slug',
            displayName: 'Bad',
            clientId: 'x',
            clientSecret: 's',
            redirectUri: 'https://acme.example.test/callback/x',
          })
          .expect(400);
      });

      it('임의 provider slug와 oauth_config로 Identity Provider를 생성할 수 있다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'slugco', 'Slug Co');

        const res = await request(fixture.app.getHttpServer())
          .post('/t/slugco/admin/identity-providers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            provider: 'custom_oidc',
            displayName: 'Custom OIDC',
            clientId: 'custom-cid',
            clientSecret: 'custom-secret',
            redirectUri: 'https://slugco.example.test/callback',
            oauthConfig: {
              authorizationUrl: 'https://idp.example.test/oauth/authorize',
              tokenUrl: 'https://idp.example.test/oauth/token',
              userinfoUrl: 'https://idp.example.test/userinfo',
              scopes: ['openid', 'email'],
              subField: 'sub',
              emailField: 'email',
            },
          })
          .expect(201);

        expect(res.body.id).toEqual(expect.any(String));
      });
    });

    describeOidc('클라이언트 설정 기반 OIDC 시나리오', () => {
      it('discovery가 tenant introspection endpoint를 광고한다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');

        const discovery = await request(fixture.app.getHttpServer())
          .get('/t/acme/oidc/.well-known/openid-configuration')
          .expect(200);

        expect(discovery.body.introspection_endpoint).toEqual(
          expect.stringMatching(/\/t\/acme\/oidc\/token\/introspection$/),
        );
      });

      it('동일한 rotating refresh token의 동시 재사용은 한 요청만 성공시키고 token family를 폐기한다', async () => {
        const adminToken = await loginAsAdmin();
        const tenant = await createTenant(adminToken, 'acme', 'Acme Corp');
        await request(fixture.app.getHttpServer())
          .post('/t/acme/admin/scopes')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'offline_access',
            displayName: 'Offline access',
            claimKeys: [],
            enabled: true,
          })
          .expect(201);
        const client = await createClient(
          adminToken,
          'acme',
          'concurrent-refresh-web',
          {
            grantTypes: ['authorization_code', 'refresh_token'],
            scope: 'openid offline_access',
            skipConsent: false,
          },
        );
        const user = await signupUser('acme', {
          username: 'concurrent-refresh-user',
          password: 'Password123!',
        });
        const login = await loginUserViaOidc({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          username: user.username,
          password: user.password,
          scope: 'openid offline_access',
          prompt: 'consent',
        });
        expect(login.refreshToken).toEqual(expect.any(String));

        const provider = await fixture.registry.get('acme');
        const originalRefreshToken = await provider.RefreshToken.find(
          login.refreshToken!,
        );
        expect(originalRefreshToken).toBeDefined();
        const grantId = originalRefreshToken!.grantId;
        if (!grantId) throw new Error('Expected refresh token grantId');
        let cacheBackfillSpy: jest.SpyInstance | undefined;
        let redisFencePropagationSpy: jest.SpyInstance | undefined;
        if (process.env.OIDC_ADAPTER_DRIVER === 'hybrid') {
          await fixture.redis.del(
            `oidc:${tenant.id}:RefreshToken:${originalRefreshToken!.jti}`,
          );
          cacheBackfillSpy = jest
            .spyOn(RedisAdapter.prototype, 'cacheById')
            .mockRejectedValue(new Error('simulated refresh token cache miss'));
          redisFencePropagationSpy = jest
            .spyOn(RedisAdapter.prototype, 'markRefreshTokenReuseConflict')
            .mockRejectedValue(
              new Error('simulated Redis fence write failure'),
            );
        }
        const secondFixture = await createApiE2eFixture({
          initializePersistence: false,
        });
        const originalRevokeGrantFamily =
          RefreshTokenReuseStore.prototype.revokeGrantFamily;
        let releaseCleanup!: () => void;
        const cleanupGate = new Promise<void>((resolve) => {
          releaseCleanup = resolve;
        });
        const revokeGrantFamilySpy = jest
          .spyOn(RefreshTokenReuseStore.prototype, 'revokeGrantFamily')
          .mockImplementation(async function (
            this: RefreshTokenReuseStore,
            id,
          ) {
            await cleanupGate;
            return originalRevokeGrantFamily.call(this, id);
          });

        const exchange = (server: unknown) =>
          request(server as any)
            .post('/t/acme/oidc/token')
            .type('form')
            .send({
              grant_type: 'refresh_token',
              client_id: client.clientId,
              refresh_token: login.refreshToken,
            });
        try {
          const responses = await Promise.all([
            exchange(fixture.app.getHttpServer()),
            exchange(secondFixture.app.getHttpServer()),
          ]);
          const winner = responses.find((response) => response.status === 200);
          const loser = responses.find((response) => response.status === 400);

          expect(responses.map((response) => response.status).sort()).toEqual([
            200, 400,
          ]);
          expect(winner?.body.access_token).toEqual(expect.any(String));
          expect(winner?.body.refresh_token).toEqual(expect.any(String));
          expect(loser?.body).toMatchObject({ error: 'invalid_grant' });

          await request(fixture.app.getHttpServer())
            .post('/t/acme/oidc/token')
            .type('form')
            .send({
              grant_type: 'refresh_token',
              client_id: client.clientId,
              refresh_token: winner!.body.refresh_token,
            })
            .expect(400)
            .expect(({ body }) => {
              expect(body).toMatchObject({ error: 'invalid_grant' });
            });
          await expect(
            provider.AccessToken.find(winner!.body.access_token as string),
          ).resolves.toBeUndefined();
          expect(
            revokeGrantFamilySpy.mock.calls.filter(([id]) => id === grantId),
          ).toHaveLength(1);

          releaseCleanup();

          await waitForRefreshTokenReuseAudit(tenant.id);
          await waitForRefreshTokenFamilyRemoval(tenant.id, grantId);

          const events = await fixture.runInRequestContext(() =>
            new EventRepositoryImpl(fixture.orm.em).list({
              tenantId: tenant.id,
              page: 1,
              limit: 50,
              action: 'TOKEN_REVOKED',
            }),
          );
          expect(
            events.items.filter(
              (event) => event.reason === 'RefreshTokenReuseDetected',
            ),
          ).toHaveLength(1);
          await expect(
            provider.AccessToken.find(winner!.body.access_token as string),
          ).resolves.toBeUndefined();
          await expect(
            provider.RefreshToken.find(winner!.body.refresh_token as string),
          ).resolves.toBeUndefined();
          await expect(provider.Grant.find(grantId)).resolves.toBeUndefined();
          const remainingGrantKeys = await fixture.redis.keys(
            `oidc:${tenant.id}:*:grant:${grantId}`,
          );
          expect(
            remainingGrantKeys.every((key) =>
              key.includes(':reuse-conflict:grant:'),
            ),
          ).toBe(true);
        } finally {
          releaseCleanup();
          revokeGrantFamilySpy.mockRestore();
          redisFencePropagationSpy?.mockRestore();
          cacheBackfillSpy?.mockRestore();
          await secondFixture.close();
        }
      });

      it('소유 resource의 user access token만 안정적인 introspection metadata를 반환한다', async () => {
        const resource = 'https://resource.example.test/orders';
        const adminToken = await loginAsAdmin();
        const tenant = await createTenant(adminToken, 'acme', 'Acme Corp');
        await request(fixture.app.getHttpServer())
          .post('/t/acme/admin/scopes')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'orders:read',
            displayName: 'Read orders',
            claimKeys: [],
            enabled: true,
          })
          .expect(201);
        const userClient = await createClient(
          adminToken,
          'acme',
          'orders-web',
          {
            scope: 'openid orders:read',
            allowedResources: ['https://resource.example.test'],
          },
        );
        const resourceServer = await createClient(
          adminToken,
          'acme',
          'orders-api',
          {
            type: 'service',
            secret: 'orders-api-introspection-secret-000001',
            redirectUris: [],
            grantTypes: ['client_credentials'],
            responseTypes: [],
            tokenEndpointAuthMethod: 'client_secret_basic',
            scope: 'orders:read',
            allowedResources: ['https://resource.example.test'],
            introspectionResources: [resource],
          },
        );
        const signup = await signupUser('acme', {
          username: 'introspection-user',
          password: 'Password123!',
        });
        const login = await loginUserViaOidc({
          tenantCode: 'acme',
          clientId: userClient.clientId,
          redirectUri: userClient.redirectUri,
          username: signup.username,
          password: signup.password,
          resource,
          scope: 'openid orders:read',
        });

        const response = await introspectToken({
          tenantCode: 'acme',
          clientId: resourceServer.clientId,
          clientSecret: resourceServer.secret,
          token: login.accessToken,
          tokenTypeHint: 'access_token',
        }).expect(200);

        expect(response.body).toMatchObject({
          active: true,
          sub: signup.userId,
          client_id: userClient.clientId,
          token_type: 'Bearer',
          exp: expect.any(Number),
          iat: expect.any(Number),
          iss: 'http://localhost:3000/t/acme/oidc',
          aud: resource,
          scope: 'openid orders:read',
          tenant_id: tenant.id,
        });
        expect(response.body).not.toHaveProperty('email');
        expect(response.body).not.toHaveProperty('roles');
        expect(response.body).not.toHaveProperty('permissions');
        expect(response.body).not.toHaveProperty('secret');
        const permittedKeys = new Set([
          'active',
          'client_id',
          'token_type',
          'exp',
          'iat',
          'iss',
          'aud',
          'tenant_id',
          'scope',
          'sub',
          'jti',
          'sid',
          'cnf',
        ]);
        expect(
          Object.keys(response.body).every((key) => permittedKeys.has(key)),
        ).toBe(true);
      });

      it('client_credentials token은 sub 없이 안정적인 introspection metadata를 반환한다', async () => {
        const resource = 'https://resource.example.test/orders';
        const adminToken = await loginAsAdmin();
        const tenant = await createTenant(adminToken, 'acme', 'Acme Corp');
        await request(fixture.app.getHttpServer())
          .post('/t/acme/admin/scopes')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'orders:read',
            displayName: 'Read orders',
            claimKeys: [],
            enabled: true,
          })
          .expect(201);
        const tokenClient = await createClient(
          adminToken,
          'acme',
          'orders-worker',
          {
            type: 'service',
            secret: 'orders-worker-token-secret-00000001',
            redirectUris: [],
            grantTypes: ['client_credentials'],
            responseTypes: [],
            tokenEndpointAuthMethod: 'client_secret_basic',
            scope: 'orders:read',
            allowedResources: ['https://resource.example.test'],
          },
        );
        const resourceServer = await createClient(
          adminToken,
          'acme',
          'orders-api',
          {
            type: 'service',
            secret: 'orders-api-introspection-secret-000002',
            redirectUris: [],
            grantTypes: ['client_credentials'],
            responseTypes: [],
            tokenEndpointAuthMethod: 'client_secret_basic',
            scope: 'orders:read',
            allowedResources: ['https://resource.example.test'],
            introspectionResources: [resource],
          },
        );

        const tokenResponse = await request(fixture.app.getHttpServer())
          .post('/t/acme/oidc/token')
          .auth(tokenClient.clientId, tokenClient.secret!, { type: 'basic' })
          .type('form')
          .send({
            grant_type: 'client_credentials',
            resource,
          })
          .expect(200);
        const response = await introspectToken({
          tenantCode: 'acme',
          clientId: resourceServer.clientId,
          clientSecret: resourceServer.secret,
          token: tokenResponse.body.access_token as string,
          tokenTypeHint: 'access_token',
        }).expect(200);

        expect(response.body).toMatchObject({
          active: true,
          client_id: tokenClient.clientId,
          token_type: 'Bearer',
          exp: expect.any(Number),
          iat: expect.any(Number),
          iss: 'http://localhost:3000/t/acme/oidc',
          aud: resource,
          tenant_id: tenant.id,
        });
        expect(response.body).not.toHaveProperty('sub');
        expect(response.body).not.toHaveProperty('scope');
      });

      it('introspection은 missing, wrong, public client credentials를 invalid_client로 거부한다', async () => {
        const resource = 'https://resource.example.test/orders';
        const adminToken = await loginAsAdmin();
        const tenant = await createTenant(adminToken, 'acme', 'Acme Corp');
        const resourceServer = await createClient(
          adminToken,
          'acme',
          'orders-api',
          {
            type: 'service',
            secret: 'orders-api-introspection-secret-000003',
            redirectUris: [],
            grantTypes: ['client_credentials'],
            responseTypes: [],
            tokenEndpointAuthMethod: 'client_secret_basic',
            scope: 'openid',
            introspectionResources: [resource],
          },
        );
        const publicClient = await createClient(
          adminToken,
          'acme',
          'public-introspection-client',
        );

        const missingCredentials = await introspectToken({
          tenantCode: 'acme',
          clientId: resourceServer.clientId,
          token: 'unknown-token',
        });
        expect(missingCredentials.body).toMatchObject({
          error: 'invalid_client',
        });
        expect(missingCredentials.status).toBe(401);
        const missingCredentialsAudit = await waitForInvalidClientAudit({
          tenantId: tenant.id,
          clientId: resourceServer.id,
          publicClientId: resourceServer.clientId,
        });

        const auditUserAgent = 'u'.repeat(300);
        const wrongSecret = await introspectToken({
          tenantCode: 'acme',
          clientId: resourceServer.clientId,
          clientSecret: 'wrong-introspection-secret-00000001',
          token: 'unknown-token',
        })
          .set('user-agent', auditUserAgent)
          .expect(401);
        expect(wrongSecret.body).toMatchObject({ error: 'invalid_client' });

        const audit = await waitForInvalidClientAudit({
          tenantId: tenant.id,
          clientId: resourceServer.id,
          publicClientId: resourceServer.clientId,
          excludedEventIds: [missingCredentialsAudit.id!],
        });
        expect(audit.metadata).toEqual({
          tenantCode: 'acme',
          endpoint: 'introspection',
        });
        expect(audit.correlationId).toEqual(expect.any(String));
        expect(audit.correlationId!.length).toBeLessThanOrEqual(128);
        expect(audit.userAgent).toBe('u'.repeat(255));
        const persisted = JSON.stringify(audit);
        expect(persisted).not.toContain('wrong-introspection-secret-00000001');
        expect(persisted).not.toContain('unknown-token');

        const unknownClientId = 'c'.repeat(255);
        await introspectToken({
          tenantCode: 'acme',
          clientId: unknownClientId,
          clientSecret: 'unknown-client-secret-redacted',
          token: 'unknown-token',
        }).expect(401);
        const unknownAudit = await waitForInvalidClientAudit({
          tenantId: tenant.id,
          clientId: null,
          publicClientId: 'c'.repeat(191),
        });
        expect(unknownAudit.resourceId).toHaveLength(191);

        const publicBasic = await introspectToken({
          tenantCode: 'acme',
          clientId: publicClient.clientId,
          clientSecret: 'public-client-basic-secret-000000001',
          token: 'unknown-token',
        }).expect(401);
        expect(publicBasic.body).toMatchObject({ error: 'invalid_client' });
      });

      it('wrong audience, unknown, revoked, cross-tenant, refresh token은 정확히 inactive다', async () => {
        const resource = 'https://resource.example.test/orders';
        const otherResource = 'https://other-resource.example.test/orders';
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        await createTenant(adminToken, 'beta', 'Beta Corp');
        for (const tenantCode of ['acme', 'beta']) {
          await request(fixture.app.getHttpServer())
            .post(`/t/${tenantCode}/admin/scopes`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              name: 'orders:read',
              displayName: 'Read orders',
              claimKeys: [],
              enabled: true,
            })
            .expect(201);
        }
        await request(fixture.app.getHttpServer())
          .post('/t/acme/admin/scopes')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'offline_access',
            displayName: 'Offline access',
            claimKeys: [],
            enabled: true,
          })
          .expect(201);
        const resourceServer = await createClient(
          adminToken,
          'acme',
          'orders-api',
          {
            type: 'service',
            secret: 'orders-api-introspection-secret-000004',
            redirectUris: [],
            grantTypes: ['client_credentials'],
            responseTypes: [],
            tokenEndpointAuthMethod: 'client_secret_basic',
            scope: 'orders:read',
            allowedResources: ['https://resource.example.test'],
            introspectionResources: [resource],
          },
        );
        const betaResourceServer = await createClient(
          adminToken,
          'beta',
          'orders-api',
          {
            type: 'service',
            secret: 'beta-orders-api-introspection-secret-000004',
            redirectUris: [],
            grantTypes: ['client_credentials'],
            responseTypes: [],
            tokenEndpointAuthMethod: 'client_secret_basic',
            scope: 'orders:read',
            allowedResources: ['https://resource.example.test'],
            introspectionResources: [resource],
          },
        );
        const accessClient = await createClient(
          adminToken,
          'acme',
          'orders-web',
          {
            scope: 'openid orders:read',
            allowedResources: [
              'https://resource.example.test',
              'https://other-resource.example.test',
            ],
          },
        );
        const refreshClient = await createClient(
          adminToken,
          'acme',
          'orders-offline-web',
          {
            grantTypes: ['authorization_code', 'refresh_token'],
            scope: 'openid orders:read offline_access',
            allowedResources: ['https://resource.example.test'],
            skipConsent: false,
          },
        );
        const betaClient = await createClient(
          adminToken,
          'beta',
          'orders-web',
          {
            scope: 'openid orders:read',
            allowedResources: ['https://resource.example.test'],
          },
        );
        const acmeUser = await signupUser('acme', {
          username: 'inactive-token-user',
          password: 'Password123!',
        });
        const betaUser = await signupUser('beta', {
          username: 'cross-tenant-token-user',
          password: 'Password123!',
        });
        const revocable = await loginUserViaOidc({
          tenantCode: 'acme',
          clientId: accessClient.clientId,
          redirectUri: accessClient.redirectUri,
          username: acmeUser.username,
          password: acmeUser.password,
          resource,
          scope: 'openid orders:read',
        });
        const wrongAudience = await loginUserViaOidc({
          tenantCode: 'acme',
          clientId: accessClient.clientId,
          redirectUri: accessClient.redirectUri,
          username: acmeUser.username,
          password: acmeUser.password,
          resource: otherResource,
          scope: 'openid orders:read',
        });
        const crossTenant = await loginUserViaOidc({
          tenantCode: 'beta',
          clientId: betaClient.clientId,
          redirectUri: betaClient.redirectUri,
          username: betaUser.username,
          password: betaUser.password,
          resource,
          scope: 'openid orders:read',
        });

        const refreshLogin = await loginUserViaOidc({
          tenantCode: 'acme',
          clientId: refreshClient.clientId,
          redirectUri: refreshClient.redirectUri,
          username: acmeUser.username,
          password: acmeUser.password,
          scope: 'openid offline_access',
          prompt: 'consent',
        });
        expect(refreshLogin.refreshToken).toEqual(expect.any(String));

        const sameClientIdCrossTenant = await introspectToken({
          tenantCode: 'beta',
          clientId: betaResourceServer.clientId,
          clientSecret: betaResourceServer.secret,
          token: revocable.accessToken,
          tokenTypeHint: 'access_token',
        }).expect(200);
        expect(sameClientIdCrossTenant.body).toEqual({ active: false });

        await revokeAccessToken('acme', revocable.accessToken);

        const inactiveTokens = [
          {
            token: wrongAudience.accessToken,
            tokenTypeHint: 'access_token',
          },
          { token: 'unknown-token', tokenTypeHint: 'access_token' },
          { token: revocable.accessToken, tokenTypeHint: 'access_token' },
          { token: crossTenant.accessToken, tokenTypeHint: 'access_token' },
          {
            token: refreshLogin.refreshToken!,
            tokenTypeHint: 'refresh_token',
          },
        ];

        for (const inactiveToken of inactiveTokens) {
          const response = await introspectToken({
            tenantCode: 'acme',
            clientId: resourceServer.clientId,
            clientSecret: resourceServer.secret,
            ...inactiveToken,
          }).expect(200);
          expect(response.body).toEqual({ active: false });
        }
      });

      it('JWT-shaped token introspection은 provider unsupported_token_type 오류를 유지한다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const resourceServer = await createClient(
          adminToken,
          'acme',
          'orders-api',
          {
            type: 'service',
            secret: 'orders-api-introspection-secret-000005',
            redirectUris: [],
            grantTypes: ['client_credentials'],
            responseTypes: [],
            tokenEndpointAuthMethod: 'client_secret_basic',
            scope: 'openid',
            introspectionResources: ['https://resource.example.test'],
          },
        );

        const response = await introspectToken({
          tenantCode: 'acme',
          clientId: resourceServer.clientId,
          clientSecret: resourceServer.secret,
          token: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyIn0.',
          tokenTypeHint: 'access_token',
        }).expect(400);

        expect(response.body).toMatchObject({
          error: 'unsupported_token_type',
        });
      });

      const jwtIt =
        process.env.OIDC_ACCESS_TOKEN_FORMAT === 'jwt' ? it : it.skip;
      jwtIt(
        'JWT resource access token은 tenant JWKS와 issuer/audience/tenant claim으로 검증된다',
        async () => {
          const resource = 'https://resource.example.test/orders';
          const adminToken = await loginAsAdmin();
          const tenant = await createTenant(adminToken, 'acme', 'Acme Corp');
          await request(fixture.app.getHttpServer())
            .post('/t/acme/admin/scopes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              name: 'orders:read',
              displayName: 'Read orders',
              claimKeys: [],
              enabled: true,
            })
            .expect(201);
          const client = await createClient(
            adminToken,
            'acme',
            'jwt-orders-web',
            {
              scope: 'openid orders:read',
              allowedResources: ['https://resource.example.test'],
              skipConsent: false,
            },
          );
          const signup = await signupUser('acme', {
            username: 'jwt-introspection-user',
            password: 'Password123!',
          });
          const login = await loginUserViaOidc({
            tenantCode: 'acme',
            clientId: client.clientId,
            redirectUri: client.redirectUri,
            username: signup.username,
            password: signup.password,
            resource,
            scope: 'openid orders:read',
            prompt: 'consent',
          });
          const tokenParts = login.accessToken.split('.');
          expect(tokenParts).toHaveLength(3);

          const header = JSON.parse(
            Buffer.from(tokenParts[0], 'base64url').toString('utf8'),
          ) as { alg?: string; kid?: string };
          const payload = JSON.parse(
            Buffer.from(tokenParts[1], 'base64url').toString('utf8'),
          ) as Record<string, unknown>;
          const jwks = await request(fixture.app.getHttpServer())
            .get('/t/acme/oidc/jwks')
            .expect(200);
          const jwk = (jwks.body.keys as Array<Record<string, unknown>>).find(
            (candidate) => candidate.kid === header.kid,
          );
          expect(jwk).toBeDefined();
          expect(
            verify(
              'RSA-SHA256',
              new Uint8Array(Buffer.from(`${tokenParts[0]}.${tokenParts[1]}`)),
              createPublicKey({ key: jwk!, format: 'jwk' }),
              new Uint8Array(Buffer.from(tokenParts[2], 'base64url')),
            ),
          ).toBe(true);
          expect(header.alg).toBe('RS256');
          expect(payload).toMatchObject({
            iss: 'http://localhost:3000/t/acme/oidc',
            aud: resource,
            tenant_id: tenant.id,
          });
        },
      );

      it('같은 테넌트의 두 클라이언트는 SSO 세션을 공유하고 RP-initiated logout을 양쪽에 전파한다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const clientA = await createClient(adminToken, 'acme', 'acme-app-a', {
          redirectUris: ['https://app-a.example.test/callback'],
          postLogoutRedirectUris: ['https://app-a.example.test/logout'],
          backchannelLogoutUri: mockRelyingParty.logoutUri('acme-app-a'),
        });
        const clientB = await createClient(adminToken, 'acme', 'acme-app-b', {
          redirectUris: ['https://app-b.example.test/callback'],
          postLogoutRedirectUris: ['https://app-b.example.test/logout'],
          backchannelLogoutUri: mockRelyingParty.logoutUri('acme-app-b'),
        });
        const signup = await signupUser('acme', {
          username: 'sso-user',
          password: 'Password123!',
        });

        const firstAuthorization = await authorizeUserViaOidc({
          tenantCode: 'acme',
          clientId: clientA.clientId,
          redirectUri: clientA.redirectUri,
          username: signup.username,
          password: signup.password,
        });
        const firstTokenResponse = await exchangeAuthorizationCode({
          agent: firstAuthorization.agent,
          tenantCode: 'acme',
          clientId: clientA.clientId,
          redirectUri: clientA.redirectUri,
          code: firstAuthorization.code,
          codeVerifier: firstAuthorization.verifier,
        }).expect(200);

        expect(firstTokenResponse.body.id_token).toEqual(expect.any(String));

        const secondPkce = buildPkce();
        const secondAuthorizeResponse = await firstAuthorization.agent
          .get('/t/acme/oidc/auth')
          .query({
            client_id: clientB.clientId,
            redirect_uri: clientB.redirectUri,
            response_type: 'code',
            scope: 'openid profile email',
            code_challenge: secondPkce.challenge,
            code_challenge_method: 'S256',
            nonce: 'nonce-sso-client-b',
            state: 'state-sso-client-b',
          })
          .expect((response) => {
            expect([302, 303]).toContain(response.status);
          });

        expect(
          (secondAuthorizeResponse.headers.location as string).startsWith(
            clientB.redirectUri,
          ),
        ).toBe(true);
        const secondCallback = new URL(
          secondAuthorizeResponse.headers.location as string,
        );
        expect(secondCallback.searchParams.get('state')).toBe(
          'state-sso-client-b',
        );
        const secondCode = secondCallback.searchParams.get('code');
        expect(secondCode).toEqual(expect.any(String));

        const secondTokenResponse = await exchangeAuthorizationCode({
          agent: firstAuthorization.agent,
          tenantCode: 'acme',
          clientId: clientB.clientId,
          redirectUri: clientB.redirectUri,
          code: secondCode as string,
          codeVerifier: secondPkce.verifier,
        }).expect(200);
        const secondIdToken = secondTokenResponse.body.id_token as string;

        expect(secondIdToken).toEqual(expect.any(String));

        const jwksResponse = await firstAuthorization.agent
          .get('/t/acme/oidc/jwks')
          .expect(200);
        mockRelyingParty.trustJwks(jwksResponse.body.keys);

        const invalidLogoutResponse = await firstAuthorization.agent
          .get('/t/acme/oidc/session/end')
          .set('Accept', 'application/json')
          .query({
            id_token_hint: secondIdToken,
            post_logout_redirect_uri: 'https://evil.example.test/logout',
          })
          .expect(400);

        expect(invalidLogoutResponse.body).toMatchObject({
          error: 'invalid_request',
          error_description: expect.stringContaining('not registered'),
        });

        const logoutResponse = await firstAuthorization.agent
          .get('/t/acme/oidc/session/end')
          .query({
            id_token_hint: secondIdToken,
            post_logout_redirect_uri: 'https://app-b.example.test/logout',
            state: 'logout-state-1234',
          })
          .expect(200);
        const logoutForm =
          /<form[^>]+action="([^"]+)"[^>]*>.*name="xsrf" value="([^"]+)"/s.exec(
            logoutResponse.text,
          );

        expect(logoutForm).toBeTruthy();

        const logoutConfirmation = await firstAuthorization.agent
          .post(toAppPath(logoutForm![1]))
          .type('form')
          .send({
            xsrf: logoutForm![2],
            logout: 'yes',
          })
          .expect(303);

        expect(logoutConfirmation.headers.location).toBe(
          'https://app-b.example.test/logout?state=logout-state-1234',
        );

        const expectedLogoutEvent = {
          'http://schemas.openid.net/event/backchannel-logout': {},
        };
        const clientANotifications = mockRelyingParty.notificationsFor(
          clientA.clientId,
        );
        const clientBNotifications = mockRelyingParty.notificationsFor(
          clientB.clientId,
        );

        expect(clientANotifications).toHaveLength(1);
        expect(clientANotifications[0]).toMatchObject({
          iss: 'http://localhost:3000/t/acme/oidc',
          aud: clientA.clientId,
          sub: signup.userId,
          events: expectedLogoutEvent,
          iat: expect.any(Number),
          jti: expect.any(String),
        });
        expect(clientANotifications[0]).not.toHaveProperty('nonce');
        expect(clientBNotifications).toHaveLength(1);
        expect(clientBNotifications[0]).toMatchObject({
          iss: 'http://localhost:3000/t/acme/oidc',
          aud: clientB.clientId,
          sub: signup.userId,
          events: expectedLogoutEvent,
          iat: expect.any(Number),
          jti: expect.any(String),
        });
        expect(clientBNotifications[0]).not.toHaveProperty('nonce');

        const authorizationAfterLogout = await firstAuthorization.agent
          .get('/t/acme/oidc/auth')
          .query({
            client_id: clientA.clientId,
            redirect_uri: clientA.redirectUri,
            response_type: 'code',
            scope: 'openid profile email',
            code_challenge: buildPkce().challenge,
            code_challenge_method: 'S256',
            nonce: 'nonce-after-logout',
            state: 'state-after-logout',
          })
          .expect((response) => {
            expect([302, 303]).toContain(response.status);
          });
        const interactionLocation = authorizationAfterLogout.headers
          .location as string;
        const interactionUid = /\/t\/acme\/interaction\/([^/?]+)/.exec(
          interactionLocation,
        )?.[1];

        expect(interactionUid).toBeDefined();

        const interactionDetails = await firstAuthorization.agent
          .get(`/t/acme/interaction/${interactionUid}/api/details`)
          .expect(200);

        expect(interactionDetails.body).toMatchObject({
          prompt: 'login',
          clientId: clientA.clientId,
        });
      });

      it('다른 테넌트는 브라우저 세션과 back-channel logout을 공유하지 않는다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        await createTenant(adminToken, 'beta', 'Beta Corp');
        const acmeClient = await createClient(
          adminToken,
          'acme',
          'shared-client',
          {
            redirectUris: ['https://acme-app.example.test/callback'],
            postLogoutRedirectUris: ['https://acme-app.example.test/logout'],
            backchannelLogoutUri:
              mockRelyingParty.logoutUri('acme-shared-client'),
          },
        );
        const betaClient = await createClient(
          adminToken,
          'beta',
          'shared-client',
          {
            redirectUris: ['https://beta-app.example.test/callback'],
            postLogoutRedirectUris: ['https://beta-app.example.test/logout'],
            backchannelLogoutUri:
              mockRelyingParty.logoutUri('beta-shared-client'),
          },
        );
        const acmeUser = await signupUser('acme', {
          username: 'cross-tenant-user',
          password: 'Password123!',
        });
        const betaUser = await signupUser('beta', {
          username: 'cross-tenant-user',
          password: 'Password123!',
        });

        const acmeAuthorization = await authorizeUserViaOidc({
          tenantCode: 'acme',
          clientId: acmeClient.clientId,
          redirectUri: acmeClient.redirectUri,
          username: acmeUser.username,
          password: acmeUser.password,
        });
        await exchangeAuthorizationCode({
          agent: acmeAuthorization.agent,
          tenantCode: 'acme',
          clientId: acmeClient.clientId,
          redirectUri: acmeClient.redirectUri,
          code: acmeAuthorization.code,
          codeVerifier: acmeAuthorization.verifier,
        }).expect(200);

        const betaPkce = buildPkce();
        const betaAuthorizeResponse = await acmeAuthorization.agent
          .get('/t/beta/oidc/auth')
          .query({
            client_id: betaClient.clientId,
            redirect_uri: betaClient.redirectUri,
            response_type: 'code',
            scope: 'openid profile email',
            code_challenge: betaPkce.challenge,
            code_challenge_method: 'S256',
            nonce: 'nonce-beta-login',
            state: 'state-beta-login',
          })
          .expect((response) => {
            expect([302, 303]).toContain(response.status);
          });
        const betaInteractionUid = /\/t\/beta\/interaction\/([^/?]+)/.exec(
          betaAuthorizeResponse.headers.location as string,
        )?.[1];
        expect(betaInteractionUid).toBeDefined();

        const betaDetails = await acmeAuthorization.agent
          .get(`/t/beta/interaction/${betaInteractionUid}/api/details`)
          .expect(200);
        expect(betaDetails.body).toMatchObject({
          prompt: 'login',
          clientId: betaClient.clientId,
        });

        const betaLogin = await acmeAuthorization.agent
          .post(`/t/beta/interaction/${betaInteractionUid}/api/login`)
          .send({
            username: betaUser.username,
            password: betaUser.password,
          })
          .expect(200);
        const betaCode = await resolveAuthorizationCode(
          acmeAuthorization.agent,
          betaLogin.body.redirectTo,
        );
        const betaTokenResponse = await exchangeAuthorizationCode({
          agent: acmeAuthorization.agent,
          tenantCode: 'beta',
          clientId: betaClient.clientId,
          redirectUri: betaClient.redirectUri,
          code: betaCode,
          codeVerifier: betaPkce.verifier,
        }).expect(200);
        const betaIdToken = betaTokenResponse.body.id_token as string;

        const betaJwks = await acmeAuthorization.agent
          .get('/t/beta/oidc/jwks')
          .expect(200);
        mockRelyingParty.trustJwks(betaJwks.body.keys);

        const betaLogout = await acmeAuthorization.agent
          .get('/t/beta/oidc/session/end')
          .query({
            id_token_hint: betaIdToken,
            post_logout_redirect_uri: 'https://beta-app.example.test/logout',
          })
          .expect(200);
        const betaLogoutForm =
          /<form[^>]+action="([^"]+)"[^>]*>.*name="xsrf" value="([^"]+)"/s.exec(
            betaLogout.text,
          );
        expect(betaLogoutForm).toBeTruthy();

        await acmeAuthorization.agent
          .post(toAppPath(betaLogoutForm![1]))
          .type('form')
          .send({ xsrf: betaLogoutForm![2], logout: 'yes' })
          .expect(303);

        expect(
          mockRelyingParty.notificationsFor('beta-shared-client'),
        ).toHaveLength(1);
        expect(
          mockRelyingParty.notificationsFor('acme-shared-client'),
        ).toHaveLength(0);

        const acmePkce = buildPkce();
        const acmeAfterBetaLogout = await acmeAuthorization.agent
          .get('/t/acme/oidc/auth')
          .query({
            client_id: acmeClient.clientId,
            redirect_uri: acmeClient.redirectUri,
            response_type: 'code',
            scope: 'openid profile email',
            code_challenge: acmePkce.challenge,
            code_challenge_method: 'S256',
            nonce: 'nonce-acme-still-sso',
            state: 'state-acme-still-sso',
          })
          .expect((response) => {
            expect([302, 303]).toContain(response.status);
          });

        expect(
          (acmeAfterBetaLogout.headers.location as string).startsWith(
            acmeClient.redirectUri,
          ),
        ).toBe(true);
      });

      it('skipConsent=false 클라이언트는 로그인 후 consent 단계를 거쳐야 한다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const client = await createClient(adminToken, 'acme', 'acme-consent', {
          skipConsent: false,
        });
        const signup = await signupUser('acme', {
          username: 'consent-user',
          password: 'Password123!',
        });

        const { agent, uid } = await beginOidcInteraction({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
        });

        const loginResponse = await agent
          .post(`/t/acme/interaction/${uid}/api/login`)
          .send({
            username: signup.username,
            password: signup.password,
          })
          .expect(200);

        const resumeResponse = await agent
          .get(toAppPath(loginResponse.body.redirectTo))
          .expect((response) => {
            expect([302, 303]).toContain(response.status);
          });

        const consentLocation = resumeResponse.headers.location as string;
        const consentUid = /\/t\/[^/]+\/interaction\/([^/?]+)/.exec(
          consentLocation,
        )?.[1];

        expect(consentUid).toBeDefined();

        const consentDetails = await agent
          .get(`/t/acme/interaction/${consentUid}/api/details`)
          .expect(200);

        expect(consentDetails.body).toMatchObject({
          uid: consentUid,
          prompt: 'consent',
          clientId: client.clientId,
        });
        expect(consentDetails.body.missingScopes).toEqual(
          expect.arrayContaining(['openid', 'profile', 'email']),
        );

        const consentResponse = await agent
          .post(`/t/acme/interaction/${consentUid}/api/consent`)
          .expect(201);

        expect(consentResponse.body).toMatchObject({
          success: true,
          redirectTo: expect.any(String),
        });

        const callbackResponse = await agent
          .get(toAppPath(consentResponse.body.redirectTo))
          .expect((response) => {
            expect([302, 303]).toContain(response.status);
          });

        const callbackLocation = new URL(
          callbackResponse.headers.location as string,
        );
        const code = callbackLocation.searchParams.get('code');

        expect(code).toBeTruthy();

        const tokenResponse = await exchangeAuthorizationCode({
          agent,
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          code: code as string,
          codeVerifier:
            'codex-e2e-code-verifier-1234567890-abcdefghijklmno-pqrstuv',
        }).expect(200);

        expect(tokenResponse.body.access_token).toEqual(expect.any(String));
      });

      it('client_secret_post 설정의 confidential client는 올바른 secret으로만 토큰 교환에 성공한다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const client = await createClient(
          adminToken,
          'acme',
          'acme-confidential',
          {
            type: 'confidential',
            secret: 'super-secret-value-1234567890-abcdefghijklmnopqrstuvwxyz',
            tokenEndpointAuthMethod: 'client_secret_post',
          },
        );
        const signup = await signupUser('acme', {
          username: 'confidential-user',
          password: 'Password123!',
        });

        const authorized = await authorizeUserViaOidc({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          username: signup.username,
          password: signup.password,
        });

        await exchangeAuthorizationCode({
          agent: authorized.agent,
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          code: authorized.code,
          codeVerifier: authorized.verifier,
        }).expect(401);

        const successfulTokenResponse = await exchangeAuthorizationCode({
          agent: authorized.agent,
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          code: authorized.code,
          codeVerifier: authorized.verifier,
          clientSecret: client.secret,
        }).expect(200);

        expect(successfulTokenResponse.body.access_token).toEqual(
          expect.any(String),
        );
      });

      it('enabled=false 클라이언트는 authorize 요청 단계에서 차단된다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const client = await createClient(adminToken, 'acme', 'acme-disabled');

        await request(fixture.app.getHttpServer())
          .put(`/t/acme/admin/clients/${client.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            enabled: false,
          })
          .expect(200);

        const authorizeFailure = await request(fixture.app.getHttpServer())
          .get('/t/acme/oidc/auth')
          .query({
            client_id: client.clientId,
            redirect_uri: client.redirectUri,
            response_type: 'code',
            scope: 'openid profile email',
            code_challenge: '7f3mSJB9V3bE2yUjSQAjhI1SMfS3R8Lez06dfvJLzyY',
            code_challenge_method: 'S256',
            nonce: 'nonce-disabled',
            state: 'state-disabled',
          })
          .expect(400);

        expect(authorizeFailure.text).toContain('invalid_client');
      });

      it('등록되지 않은 redirect_uri는 authorize 요청 단계에서 거부된다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        await createClient(adminToken, 'acme', 'acme-redirect-check');

        const authorizeFailure = await request(fixture.app.getHttpServer())
          .get('/t/acme/oidc/auth')
          .set('Accept', 'application/json')
          .query({
            client_id: 'acme-redirect-check',
            redirect_uri: 'https://evil.example.test/callback',
            response_type: 'code',
            scope: 'openid profile email',
            code_challenge: '7f3mSJB9V3bE2yUjSQAjhI1SMfS3R8Lez06dfvJLzyY',
            code_challenge_method: 'S256',
            nonce: 'nonce-invalid-redirect',
            state: 'state-invalid-redirect',
          })
          .expect(400);

        expect(authorizeFailure.body).toMatchObject({
          error: 'invalid_redirect_uri',
        });
      });

      it('authorization 이후 token 교환 시 redirect_uri가 다르면 invalid_grant를 반환한다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const client = await createClient(
          adminToken,
          'acme',
          'acme-redirect-mismatch',
          {
            redirectUris: [
              'https://acme.example.test/callback',
              'https://acme.example.test/alt-callback',
            ],
          },
        );
        const signup = await signupUser('acme', {
          username: 'redirect-mismatch-user',
          password: 'Password123!',
        });

        const authorized = await authorizeUserViaOidc({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUris[0],
          username: signup.username,
          password: signup.password,
        });

        const failureResponse = await exchangeAuthorizationCode({
          agent: authorized.agent,
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUris[1],
          code: authorized.code,
          codeVerifier: authorized.verifier,
        }).expect(400);

        expect(failureResponse.body).toMatchObject({
          error: 'invalid_grant',
        });

        const successResponse = await exchangeAuthorizationCode({
          agent: authorized.agent,
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUris[0],
          code: authorized.code,
          codeVerifier: authorized.verifier,
        }).expect(200);

        expect(successResponse.body.access_token).toEqual(expect.any(String));
      });

      it('여러 redirect_uri 중 등록된 URI를 사용하면 로그인과 토큰 교환이 성공한다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const client = await createClient(
          adminToken,
          'acme',
          'acme-multi-redirect',
          {
            redirectUris: [
              'https://acme.example.test/callback',
              'https://acme.example.test/mobile-callback',
            ],
          },
        );
        const signup = await signupUser('acme', {
          username: 'multi-redirect-user',
          password: 'Password123!',
        });

        const login = await loginUserViaOidc({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUris[1],
          username: signup.username,
          password: signup.password,
        });

        await request(fixture.app.getHttpServer())
          .get('/auth/profile')
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${login.accessToken}`)
          .expect(200);
      });
    });

    describeUser('일반 유저 시나리오', () => {
      it('회원가입 후 실제 OIDC authorize/login/token 교환으로 로그인하고 프로필을 조회할 수 있다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const client = await createClient(adminToken, 'acme', 'acme-web');
        const signup = await signupUser('acme', {
          username: 'alice',
          password: 'Password123!',
        });

        const login = await loginUserViaOidc({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          username: signup.username,
          password: signup.password,
        });

        const profileResponse = await request(fixture.app.getHttpServer())
          .get('/auth/profile')
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${login.accessToken}`)
          .expect(200);

        expect(profileResponse.body).toMatchObject({
          id: signup.userId,
          username: 'alice',
          email: 'alice@acme.test',
          status: 'ACTIVE',
        });
      });

      it('로그인한 사용자는 프로필을 수정하고 비밀번호를 바꿀 수 있다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const client = await createClient(adminToken, 'acme', 'acme-web');
        const signup = await signupUser('acme', {
          username: 'alice',
          password: 'Password123!',
        });

        const firstLogin = await loginUserViaOidc({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          username: signup.username,
          password: signup.password,
        });

        await request(fixture.app.getHttpServer())
          .put('/auth/profile')
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${firstLogin.accessToken}`)
          .send({
            email: 'alice+updated@acme.test',
            phone: '+821011112222',
          })
          .expect(200);

        const updatedProfile = await request(fixture.app.getHttpServer())
          .get('/auth/profile')
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${firstLogin.accessToken}`)
          .expect(200);

        expect(updatedProfile.body).toMatchObject({
          email: 'alice+updated@acme.test',
          phone: '+821011112222',
        });

        await request(fixture.app.getHttpServer())
          .put('/auth/password')
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${firstLogin.accessToken}`)
          .send({
            currentPassword: 'Password123!',
            newPassword: 'Password456!',
          })
          .expect(200);

        await request(fixture.app.getHttpServer())
          .post('/t/acme/interaction/login-uid/api/login')
          .send({
            username: 'alice',
            password: 'Password123!',
          })
          .expect(401);

        const secondLogin = await loginUserViaOidc({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          username: 'alice',
          password: 'Password456!',
        });

        const profileAfterPasswordChange = await request(
          fixture.app.getHttpServer(),
        )
          .get('/auth/profile')
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${secondLogin.accessToken}`)
          .expect(200);

        expect(profileAfterPasswordChange.body.username).toBe('alice');
      });

      it('동의 목록을 조회하고 특정 동의를 철회할 수 있다', async () => {
        const adminToken = await loginAsAdmin();
        const tenant = await createTenant(adminToken, 'acme', 'Acme Corp');
        const client = await createClient(adminToken, 'acme', 'acme-web');
        const signup = await signupUser('acme', {
          username: 'alice',
          password: 'Password123!',
        });

        const { clientModel } = await fixture.runInRequestContext(async () => {
          const tenantModel = await fixture.tenantRepository.findByCode(
            tenant.code,
          );
          const clientModel = await fixture.clientRepository.findByClientId(
            tenantModel!.id,
            client.clientId,
          );

          await fixture.consentRepository.save(
            new ConsentModel({
              tenantId: tenantModel!.id,
              userId: signup.userId,
              clientRefId: clientModel!.id,
              clientId: client.clientId,
              clientName: 'acme web',
              grantedScopes: 'openid profile email',
              grantedAt: new Date(),
            }),
          );

          return { clientModel };
        });

        const login = await loginUserViaOidc({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          username: signup.username,
          password: signup.password,
        });

        const consentsResponse = await request(fixture.app.getHttpServer())
          .get('/auth/consents')
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${login.accessToken}`)
          .expect(200);

        expect(consentsResponse.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              clientId: 'acme-web',
              clientName: 'acme web',
            }),
          ]),
        );

        await request(fixture.app.getHttpServer())
          .delete(`/auth/consents/${clientModel!.id}`)
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${login.accessToken}`)
          .expect(200);

        const afterRevokeResponse = await request(fixture.app.getHttpServer())
          .get('/auth/consents')
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${login.accessToken}`)
          .expect(200);

        expect(afterRevokeResponse.body).toEqual([]);
      });

      it('mock OIDC IdP로 연결된 사용자는 외부 인증만으로 OIDC 토큰을 발급받는다', async () => {
        const adminToken = await loginAsAdmin();
        const tenant = await createTenant(adminToken, 'acme', 'Acme Corp');
        const client = await createClient(adminToken, 'acme', 'mock-idp-web');
        const signup = await signupUser('acme', {
          username: 'idp-linked-user',
          password: 'Password123!',
        });
        const provider = 'mock_oidc';
        const providerSub = 'mock-sub-linked-user';
        const providerEmail = 'linked-user@mock-idp.test';
        mockIdp.setProfile({
          sub: providerSub,
          email: providerEmail,
          name: 'Linked User',
        });
        await createMockOidcIdentityProvider({
          adminToken,
          tenantCode: 'acme',
          provider,
        });
        await linkUserIdentity({
          tenantId: tenant.id,
          userId: signup.userId,
          provider,
          providerSub,
          email: providerEmail,
        });

        const interaction = await beginOidcInteraction({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
        });

        const detailsResponse = await interaction.agent
          .get(`/t/acme/interaction/${interaction.uid}/api/details`)
          .expect(200);

        expect(detailsResponse.body.idpList).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              provider,
              name: 'Mock OIDC',
              protocol: 'oauth2',
            }),
          ]),
        );

        const idpRedirectResponse = await interaction.agent
          .get(`/t/acme/interaction/${interaction.uid}/idp/${provider}`)
          .set('host', 'auth.e2e.test')
          .expect(302);
        const authorizationUrl = new URL(
          idpRedirectResponse.headers.location as string,
        );

        expect(authorizationUrl.origin).toBe(mockIdp.origin);
        expect(authorizationUrl.searchParams.get('client_id')).toBe(
          mockIdp.clientId,
        );
        expect(authorizationUrl.searchParams.get('state')).toContain(
          `${interaction.uid}:`,
        );

        const idpCallbackUrl = await fetchMockIdpRedirect(authorizationUrl);

        expect(idpCallbackUrl.pathname).toBe(
          `/t/acme/interaction/${interaction.uid}/idp/${provider}/callback`,
        );
        expect(idpCallbackUrl.searchParams.get('code')).toBeTruthy();

        const callbackResponse = await interaction.agent
          .get(toAppPath(idpCallbackUrl.toString()))
          .set('host', 'auth.e2e.test')
          .expect((response) => {
            expect([302, 303]).toContain(response.status);
          });
        const code = await resolveAuthorizationCode(
          interaction.agent,
          callbackResponse.headers.location as string,
        );

        const tokenResponse = await exchangeAuthorizationCode({
          agent: interaction.agent,
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          code,
          codeVerifier: interaction.verifier,
        }).expect(200);

        const profileResponse = await request(fixture.app.getHttpServer())
          .get('/auth/profile')
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${tokenResponse.body.access_token}`)
          .expect(200);

        expect(profileResponse.body).toMatchObject({
          id: signup.userId,
          username: signup.username,
          email: signup.username + '@acme.test',
        });
      });

      it('로그인한 사용자는 mock OIDC IdP 계정을 연결한 뒤 외부 인증으로 로그인할 수 있다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const client = await createClient(
          adminToken,
          'acme',
          'mock-idp-link-web',
        );
        const signup = await signupUser('acme', {
          username: 'idp-linking-user',
          password: 'Password123!',
        });
        const provider = 'mock_oidc';
        const providerSub = 'mock-sub-link-flow-user';
        const providerEmail = 'link-flow-user@mock-idp.test';
        mockIdp.setProfile({
          sub: providerSub,
          email: providerEmail,
          name: 'Link Flow User',
        });
        await createMockOidcIdentityProvider({
          adminToken,
          tenantCode: 'acme',
          provider,
        });
        const login = await loginUserViaOidc({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          username: signup.username,
          password: signup.password,
        });

        const startResponse = await request(fixture.app.getHttpServer())
          .post(`/auth/identity-links/${provider}/start`)
          .query({ tenantCode: 'acme' })
          .set('host', 'auth.e2e.test')
          .set('Authorization', `Bearer ${login.accessToken}`)
          .send({ returnTo: '/admin/security' })
          .expect(201);
        const authorizationUrl = new URL(startResponse.body.authorizationUrl);

        expect(authorizationUrl.origin).toBe(mockIdp.origin);
        expect(authorizationUrl.searchParams.get('client_id')).toBe(
          mockIdp.clientId,
        );
        expect(authorizationUrl.searchParams.get('state')).toBeTruthy();

        const idpCallbackUrl = await fetchMockIdpRedirect(authorizationUrl);

        expect(idpCallbackUrl.pathname).toBe(
          `/auth/identity-links/${provider}/callback`,
        );
        expect(idpCallbackUrl.searchParams.get('tenantCode')).toBe('acme');
        expect(idpCallbackUrl.searchParams.get('code')).toBeTruthy();

        const callbackResponse = await request(fixture.app.getHttpServer())
          .get(toAppPath(idpCallbackUrl.toString()))
          .set('host', 'auth.e2e.test')
          .expect(302);

        expect(callbackResponse.headers.location).toBe(
          '/admin/security?identityLinked=mock_oidc',
        );

        const linksResponse = await request(fixture.app.getHttpServer())
          .get('/auth/identity-links')
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${login.accessToken}`)
          .expect(200);

        expect(linksResponse.body).toEqual([
          expect.objectContaining({
            provider,
            email: providerEmail,
          }),
        ]);

        const externalLogin = await beginOidcInteraction({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
        });
        const idpRedirectResponse = await externalLogin.agent
          .get(`/t/acme/interaction/${externalLogin.uid}/idp/${provider}`)
          .set('host', 'auth.e2e.test')
          .expect(302);
        const externalAuthorizationUrl = new URL(
          idpRedirectResponse.headers.location as string,
        );
        const externalCallbackUrl = await fetchMockIdpRedirect(
          externalAuthorizationUrl,
        );
        const externalCallbackResponse = await externalLogin.agent
          .get(toAppPath(externalCallbackUrl.toString()))
          .set('host', 'auth.e2e.test')
          .expect((response) => {
            expect([302, 303]).toContain(response.status);
          });
        const code = await resolveAuthorizationCode(
          externalLogin.agent,
          externalCallbackResponse.headers.location as string,
        );
        const tokenResponse = await exchangeAuthorizationCode({
          agent: externalLogin.agent,
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          code,
          codeVerifier: externalLogin.verifier,
        }).expect(200);

        const profileResponse = await request(fixture.app.getHttpServer())
          .get('/auth/profile')
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${tokenResponse.body.access_token}`)
          .expect(200);

        expect(profileResponse.body).toMatchObject({
          id: signup.userId,
          username: signup.username,
        });
      });

      it('mock OIDC IdP 사용자가 연결되지 않았으면 interaction 오류로 되돌린다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const client = await createClient(
          adminToken,
          'acme',
          'mock-idp-unlinked-web',
        );
        const provider = 'mock_oidc';
        mockIdp.setProfile({
          sub: 'mock-sub-unlinked-user',
          email: 'unlinked-user@mock-idp.test',
        });
        await createMockOidcIdentityProvider({
          adminToken,
          tenantCode: 'acme',
          provider,
        });

        const interaction = await beginOidcInteraction({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
        });
        const idpRedirectResponse = await interaction.agent
          .get(`/t/acme/interaction/${interaction.uid}/idp/${provider}`)
          .set('host', 'auth.e2e.test')
          .expect(302);
        const authorizationUrl = new URL(
          idpRedirectResponse.headers.location as string,
        );
        const idpCallbackUrl = await fetchMockIdpRedirect(authorizationUrl);

        const callbackResponse = await interaction.agent
          .get(toAppPath(idpCallbackUrl.toString()))
          .set('host', 'auth.e2e.test')
          .expect(302);
        const callbackLocation = new URL(
          callbackResponse.headers.location as string,
          'http://127.0.0.1',
        );

        expect(callbackLocation.pathname).toBe(
          `/t/acme/interaction/${interaction.uid}`,
        );
        expect(callbackLocation.searchParams.get('error')).toBe(
          'idp_user_not_linked',
        );
      });

      it('TOTP MFA 등록 후 OIDC 로그인은 MFA 검증을 거쳐 토큰 교환에 성공한다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const client = await createClient(adminToken, 'acme', 'mfa-totp-web');
        const signup = await signupUser('acme', {
          username: 'mfa-user',
          password: 'Password123!',
        });

        const initialLogin = await loginUserViaOidc({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          username: signup.username,
          password: signup.password,
        });
        const { secret } = await enrollTotp({
          tenantCode: 'acme',
          accessToken: initialLogin.accessToken,
        });

        const profileResponse = await request(fixture.app.getHttpServer())
          .get('/auth/profile')
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${initialLogin.accessToken}`)
          .expect(200);

        expect(profileResponse.body).toMatchObject({
          username: signup.username,
          mfaEnabled: true,
        });

        const mfaLogin = await beginOidcInteraction({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
        });

        const loginResponse = await mfaLogin.agent
          .post(`/t/acme/interaction/${mfaLogin.uid}/api/login`)
          .send({
            username: signup.username,
            password: signup.password,
          })
          .expect(200);

        expect(loginResponse.body).toMatchObject({
          success: true,
          mfaRequired: true,
          methods: expect.arrayContaining(['totp', 'recovery_code']),
        });

        const invalidCode = buildInvalidTotpCode(generateTotpCode(secret));
        await mfaLogin.agent
          .post(`/t/acme/interaction/${mfaLogin.uid}/api/mfa`)
          .send({
            method: 'totp',
            code: invalidCode,
          })
          .expect(401);

        const mfaResponse = await mfaLogin.agent
          .post(`/t/acme/interaction/${mfaLogin.uid}/api/mfa`)
          .send({
            method: 'totp',
            code: generateTotpCode(secret),
          })
          .expect(200);

        expect(mfaResponse.body).toMatchObject({
          success: true,
          redirectTo: expect.any(String),
        });

        const code = await resolveAuthorizationCode(
          mfaLogin.agent,
          mfaResponse.body.redirectTo,
        );
        const tokenResponse = await exchangeAuthorizationCode({
          agent: mfaLogin.agent,
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          code,
          codeVerifier: mfaLogin.verifier,
        }).expect(200);

        expect(tokenResponse.body.access_token).toEqual(expect.any(String));
      });

      it('MFA 선호도를 비활성화하면 등록된 TOTP가 있어도 정책 없는 OIDC 로그인은 MFA를 생략한다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const client = await createClient(
          adminToken,
          'acme',
          'mfa-preference-web',
        );
        const signup = await signupUser('acme', {
          username: 'mfa-preference-user',
          password: 'Password123!',
        });

        const initialLogin = await loginUserViaOidc({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          username: signup.username,
          password: signup.password,
        });
        await enrollTotp({
          tenantCode: 'acme',
          accessToken: initialLogin.accessToken,
        });

        await request(fixture.app.getHttpServer())
          .put('/auth/mfa/preference')
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${initialLogin.accessToken}`)
          .send({ enabled: false })
          .expect(200);

        const profileResponse = await request(fixture.app.getHttpServer())
          .get('/auth/profile')
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${initialLogin.accessToken}`)
          .expect(200);

        expect(profileResponse.body.mfaEnabled).toBe(false);

        const login = await authorizeUserViaOidc({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          username: signup.username,
          password: signup.password,
        });

        const tokenResponse = await exchangeAuthorizationCode({
          agent: login.agent,
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          code: login.code,
          codeVerifier: login.verifier,
        }).expect(200);

        expect(tokenResponse.body.access_token).toEqual(expect.any(String));
      });

      it('MFA credential이 없는 사용자는 MFA 선호도 활성화가 거부된다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const client = await createClient(
          adminToken,
          'acme',
          'mfa-no-credential-web',
        );
        const signup = await signupUser('acme', {
          username: 'mfa-no-credential-user',
          password: 'Password123!',
        });

        const login = await loginUserViaOidc({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          username: signup.username,
          password: signup.password,
        });

        const response = await request(fixture.app.getHttpServer())
          .put('/auth/mfa/preference')
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${login.accessToken}`)
          .send({ enabled: true })
          .expect(400);

        expect(response.body.message).toBe('MFA credential is required');
      });

      it('복구 코드는 MFA 로그인에 한 번만 사용할 수 있다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const client = await createClient(
          adminToken,
          'acme',
          'mfa-recovery-web',
        );
        const signup = await signupUser('acme', {
          username: 'mfa-recovery-user',
          password: 'Password123!',
        });

        const initialLogin = await loginUserViaOidc({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          username: signup.username,
          password: signup.password,
        });
        const { recoveryCodes } = await enrollTotp({
          tenantCode: 'acme',
          accessToken: initialLogin.accessToken,
        });
        const recoveryCode = recoveryCodes[0];

        const firstMfaLogin = await beginOidcInteraction({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
        });
        await firstMfaLogin.agent
          .post(`/t/acme/interaction/${firstMfaLogin.uid}/api/login`)
          .send({
            username: signup.username,
            password: signup.password,
          })
          .expect(200);

        const firstMfaResponse = await firstMfaLogin.agent
          .post(`/t/acme/interaction/${firstMfaLogin.uid}/api/mfa`)
          .send({
            method: 'recovery_code',
            code: recoveryCode,
          })
          .expect(200);

        const firstCode = await resolveAuthorizationCode(
          firstMfaLogin.agent,
          firstMfaResponse.body.redirectTo,
        );
        await exchangeAuthorizationCode({
          agent: firstMfaLogin.agent,
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          code: firstCode,
          codeVerifier: firstMfaLogin.verifier,
        }).expect(200);

        const secondMfaLogin = await beginOidcInteraction({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
        });
        await secondMfaLogin.agent
          .post(`/t/acme/interaction/${secondMfaLogin.uid}/api/login`)
          .send({
            username: signup.username,
            password: signup.password,
          })
          .expect(200);

        const reuseResponse = await secondMfaLogin.agent
          .post(`/t/acme/interaction/${secondMfaLogin.uid}/api/mfa`)
          .send({
            method: 'recovery_code',
            code: recoveryCode,
          })
          .expect(401);

        expect(reuseResponse.body).toMatchObject({ error: 'mfa_failed' });
      });

      it('복구 코드 상태를 조회하고 재발급하면 기존 코드는 폐기된다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const client = await createClient(adminToken, 'acme', 'mfa-rotate-web');
        const signup = await signupUser('acme', {
          username: 'mfa-rotate-user',
          password: 'Password123!',
        });

        const initialLogin = await loginUserViaOidc({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          username: signup.username,
          password: signup.password,
        });
        const { recoveryCodes } = await enrollTotp({
          tenantCode: 'acme',
          accessToken: initialLogin.accessToken,
        });

        await request(fixture.app.getHttpServer())
          .get('/auth/mfa/recovery-codes/status')
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${initialLogin.accessToken}`)
          .expect(200)
          .expect(({ body }) => {
            expect(body).toEqual({
              remaining: 10,
              total: 10,
              used: 0,
              low: false,
            });
          });

        const rotateResponse = await request(fixture.app.getHttpServer())
          .post('/auth/mfa/recovery-codes/rotate')
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${initialLogin.accessToken}`)
          .expect(201);
        expect(rotateResponse.body.recoveryCodes).toHaveLength(10);
        expect(rotateResponse.body.recoveryCodes).not.toContain(
          recoveryCodes[0],
        );

        const oldCodeLogin = await beginOidcInteraction({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
        });
        await oldCodeLogin.agent
          .post(`/t/acme/interaction/${oldCodeLogin.uid}/api/login`)
          .send({
            username: signup.username,
            password: signup.password,
          })
          .expect(200);
        await oldCodeLogin.agent
          .post(`/t/acme/interaction/${oldCodeLogin.uid}/api/mfa`)
          .send({
            method: 'recovery_code',
            code: recoveryCodes[0],
          })
          .expect(401);

        const newCodeLogin = await beginOidcInteraction({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
        });
        await newCodeLogin.agent
          .post(`/t/acme/interaction/${newCodeLogin.uid}/api/login`)
          .send({
            username: signup.username,
            password: signup.password,
          })
          .expect(200);
        const newMfaResponse = await newCodeLogin.agent
          .post(`/t/acme/interaction/${newCodeLogin.uid}/api/mfa`)
          .send({
            method: 'recovery_code',
            code: rotateResponse.body.recoveryCodes[0],
          })
          .expect(200);

        const code = await resolveAuthorizationCode(
          newCodeLogin.agent,
          newMfaResponse.body.redirectTo,
        );
        await exchangeAuthorizationCode({
          agent: newCodeLogin.agent,
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          code,
          codeVerifier: newCodeLogin.verifier,
        }).expect(200);

        await request(fixture.app.getHttpServer())
          .get('/auth/mfa/recovery-codes/status')
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${initialLogin.accessToken}`)
          .expect(200)
          .expect(({ body }) => {
            expect(body).toEqual({
              remaining: 9,
              total: 10,
              used: 1,
              low: false,
            });
          });
      });

      it('회원 탈퇴 후 같은 계정으로 다시 로그인할 수 없다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const client = await createClient(adminToken, 'acme', 'acme-web');
        const signup = await signupUser('acme', {
          username: 'alice',
          password: 'Password123!',
        });

        const login = await loginUserViaOidc({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          username: signup.username,
          password: signup.password,
        });

        await request(fixture.app.getHttpServer())
          .post('/auth/withdraw')
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${login.accessToken}`)
          .send({
            password: 'Password123!',
          })
          .expect(201);

        await request(fixture.app.getHttpServer())
          .post('/t/acme/interaction/login-uid/api/login')
          .send({
            username: signup.username,
            password: signup.password,
          })
          .expect(401);
      });

      it('OIDC 로그인 실패와 잘못된 PKCE 토큰 교환을 거부한다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const client = await createClient(adminToken, 'acme', 'acme-web');
        const signup = await signupUser('acme', {
          username: 'alice',
          password: 'Password123!',
        });

        const invalidLogin = await beginOidcInteraction({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
        });

        const invalidLoginResponse = await invalidLogin.agent
          .post(`/t/acme/interaction/${invalidLogin.uid}/api/login`)
          .send({
            username: signup.username,
            password: 'WrongPassword123!',
          })
          .expect(401);

        expect(invalidLoginResponse.body).toMatchObject({
          error: 'invalid_credentials',
        });

        const authorized = await authorizeUserViaOidc({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          username: signup.username,
          password: signup.password,
        });

        const wrongVerifier =
          'codex-e2e-wrong-code-verifier-1234567890-abcdefghijklmno-pqrstuv';

        const tokenFailureResponse = await authorized.agent
          .post('/t/acme/oidc/token')
          .type('form')
          .send({
            grant_type: 'authorization_code',
            client_id: client.clientId,
            redirect_uri: client.redirectUri,
            code: authorized.code,
            code_verifier: wrongVerifier,
          })
          .expect(400);

        expect(tokenFailureResponse.body).toMatchObject({
          error: 'invalid_grant',
        });
      });

      it('일반 유저 API는 tenant context, 인증, 입력 검증 실패를 반환한다', async () => {
        const adminToken = await loginAsAdmin();
        await createTenant(adminToken, 'acme', 'Acme Corp');
        const client = await createClient(adminToken, 'acme', 'acme-web');
        const signup = await signupUser('acme', {
          username: 'alice',
          password: 'Password123!',
        });

        await request(fixture.app.getHttpServer())
          .post('/auth/signup')
          .send({
            username: 'missing-tenant',
            password: 'Password123!',
            email: 'missing-tenant@acme.test',
          })
          .expect(400);

        await request(fixture.app.getHttpServer())
          .post('/auth/signup')
          .query({ tenantCode: 'acme' })
          .send({
            username: 'bad-phone',
            password: 'Password123!',
            phone: 'not-a-phone',
          })
          .expect(400);

        await request(fixture.app.getHttpServer())
          .get('/auth/profile')
          .query({ tenantCode: 'acme' })
          .expect(403);

        const login = await loginUserViaOidc({
          tenantCode: 'acme',
          clientId: client.clientId,
          redirectUri: client.redirectUri,
          username: signup.username,
          password: signup.password,
        });

        await request(fixture.app.getHttpServer())
          .get('/auth/profile')
          .set('Authorization', `Bearer ${login.accessToken}`)
          .expect(400);

        await request(fixture.app.getHttpServer())
          .put('/auth/profile')
          .query({ tenantCode: 'acme' })
          .set('Authorization', `Bearer ${login.accessToken}`)
          .send({
            phone: 'invalid-phone',
          })
          .expect(400);
      });
    });
  });
}
