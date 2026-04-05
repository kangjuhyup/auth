import { createHash } from 'node:crypto';
import request from 'supertest';
import { ConsentModel } from '@domain/models/consent';
import { ApiE2eFixture, createApiE2eFixture } from './support/api-test-app';

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
describe('API E2E', () => {
  let fixture!: ApiE2eFixture;

  beforeAll(async () => {
    fixture = await createApiE2eFixture();
  });

  beforeEach(async () => {
    await fixture.resetPersistence();
  });

  afterAll(async () => {
    if (fixture) {
      await fixture.close();
    }
  });

  function buildPkce(): { verifier: string; challenge: string } {
    const verifier =
      'codex-e2e-code-verifier-1234567890-abcdefghijklmno-pqrstuv';
    const challenge = createHash('sha256').update(verifier).digest('base64url');

    return { verifier, challenge };
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
      token: expect.any(String),
      username: fixture.env.adminUsername,
    });

    return response.body.token as string;
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
      skipConsent?: boolean;
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
      tokenEndpointAuthMethod:
        overrides?.tokenEndpointAuthMethod ?? 'none',
      scope: overrides?.scope ?? 'openid profile email',
      postLogoutRedirectUris: overrides?.postLogoutRedirectUris ?? [
        `https://${tenantCode}.example.test/logout`,
      ],
      applicationType: overrides?.applicationType ?? 'web',
      allowedResources:
        overrides?.allowedResources ?? ['https://resource.example.test'],
      skipConsent: overrides?.skipConsent ?? true,
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
  }) {
    const agent = request.agent(fixture.app.getHttpServer());
    const { verifier, challenge } = buildPkce();

    const authorizeResponse = await agent
      .get(`/t/${params.tenantCode}/oidc/auth`)
      .query({
        client_id: params.clientId,
        redirect_uri: params.redirectUri,
        response_type: 'code',
        scope: 'openid profile email',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        nonce: 'nonce-1234',
        state: 'state-1234',
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
  }) {
    const { agent, uid, verifier } = await beginOidcInteraction(params);

    const loginResponse = await agent
      .post(`/t/${params.tenantCode}/interaction/${uid}/api/login`)
      .send({
        username: params.username,
        password: params.password,
      })
      .expect(201);

    expect(loginResponse.body).toMatchObject({
      success: true,
      mfaRequired: false,
      redirectTo: expect.any(String),
    });

    const resumeResponse = await agent
      .get(toAppPath(loginResponse.body.redirectTo))
      .expect((response) => {
        expect([302, 303]).toContain(response.status);
      });

    const callbackLocation = new URL(resumeResponse.headers.location as string);
    const code = callbackLocation.searchParams.get('code');

    expect(code).toBeTruthy();

    return {
      agent,
      code: code as string,
      verifier,
      uid,
    };
  }

  async function loginUserViaOidc(params: {
    tenantCode: string;
    clientId: string;
    redirectUri: string;
    username: string;
    password: string;
  }): Promise<{ accessToken: string }> {
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
      })
      .expect(200);

    expect(tokenResponse.body.access_token).toEqual(expect.any(String));

    return {
      accessToken: tokenResponse.body.access_token as string,
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
      });
  }

  it('헬스 체크 요청 시 서비스 상태를 반환한다', async () => {
    await request(fixture.app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  describe('관리자 시나리오', () => {
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
        .expect(200);

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
        .delete(`/t/acme/admin/roles/${role.id}/permissions/${anotherPermission.id}`)
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

    it('Identity Provider는 없는 id 404, 미인증 403, 허용되지 않은 provider 400을 반환한다', async () => {
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
          provider: 'github',
          displayName: 'GitHub',
          clientId: 'gh-e2e',
          redirectUri: 'https://acme.example.test/callback/gh',
        })
        .expect(400);
    });
  });

  describe('클라이언트 설정 기반 OIDC 시나리오', () => {
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
        .expect(201);

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
          secret:
            'super-secret-value-1234567890-abcdefghijklmnopqrstuvwxyz',
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
          code_challenge:
            '7f3mSJB9V3bE2yUjSQAjhI1SMfS3R8Lez06dfvJLzyY',
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
          code_challenge:
            '7f3mSJB9V3bE2yUjSQAjhI1SMfS3R8Lez06dfvJLzyY',
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

  describe('일반 유저 시나리오', () => {
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
