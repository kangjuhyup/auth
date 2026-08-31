import { ConfigService } from '@nestjs/config';
import {
  resolveOpenApiCorsOrigin,
  shouldEnableOpenApiDocs,
} from '@presentation/openapi';
import {
  OpenApiResponseSchemas,
  paginatedSchema,
} from '@presentation/openapi-response';
import { applyEndpointReference } from '@presentation/openapi-endpoints';

function config(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('openapi docs', () => {
  it('production에서는 명시적으로 켜지 않으면 OpenAPI 문서를 비활성화한다', () => {
    expect(shouldEnableOpenApiDocs(config({ NODE_ENV: 'production' }))).toBe(
      false,
    );
  });

  it('OPENAPI_DOCS_ENABLED=true이면 production에서도 OpenAPI 문서를 활성화한다', () => {
    expect(
      shouldEnableOpenApiDocs(
        config({ NODE_ENV: 'production', OPENAPI_DOCS_ENABLED: 'true' }),
      ),
    ).toBe(true);
  });

  it('개발 환경에서는 Auth Docs origin의 OpenAPI JSON CORS를 기본 허용한다', () => {
    expect(
      resolveOpenApiCorsOrigin(
        config({ NODE_ENV: 'development' }),
        'http://localhost:3100',
      ),
    ).toBe('http://localhost:3100');
  });

  it('production에서는 명시된 origin만 OpenAPI JSON CORS를 허용한다', () => {
    const productionConfig = config({
      NODE_ENV: 'production',
      OPENAPI_CORS_ORIGINS: 'https://kangjuhyup.github.io',
    });

    expect(
      resolveOpenApiCorsOrigin(
        productionConfig,
        'https://kangjuhyup.github.io',
      ),
    ).toBe('https://kangjuhyup.github.io');
    expect(
      resolveOpenApiCorsOrigin(productionConfig, 'http://localhost:3100'),
    ).toBeUndefined();
  });

  it('페이지네이션 응답 스키마는 items와 페이지 정보를 포함한다', () => {
    const schema = paginatedSchema(OpenApiResponseSchemas.client) as {
      properties: Record<string, unknown>;
    };

    expect(schema.properties['items']).toEqual({
      type: 'array',
      items: OpenApiResponseSchemas.client,
    });
    expect(schema.properties['total']).toEqual({
      type: 'integer',
      example: 42,
    });
    expect(schema.properties['page']).toEqual({
      type: 'integer',
      example: 1,
    });
    expect(schema.properties['limit']).toEqual({
      type: 'integer',
      example: 20,
    });
  });

  it('node-oidc-provider가 처리하는 OIDC protocol endpoint를 OpenAPI paths에 병합한다', () => {
    const document: { paths: Record<string, any> } = { paths: {} };

    applyEndpointReference(document);

    expect(Object.keys(document.paths).sort()).toEqual([
      '/t/{tenantCode}/oidc/.well-known/openid-configuration',
      '/t/{tenantCode}/oidc/auth',
      '/t/{tenantCode}/oidc/jwks',
      '/t/{tenantCode}/oidc/me',
      '/t/{tenantCode}/oidc/request',
      '/t/{tenantCode}/oidc/session/end',
      '/t/{tenantCode}/oidc/token',
      '/t/{tenantCode}/oidc/token/introspection',
      '/t/{tenantCode}/oidc/token/revocation',
    ]);
    expect(
      document.paths['/t/{tenantCode}/oidc/auth']?.get?.description,
    ).toContain('PKCE is required with S256');
    expect(
      document.paths['/t/{tenantCode}/oidc/token']?.post?.requestBody,
    ).toBeDefined();
    expect(document.paths['/t/{tenantCode}/oidc/jwks']?.get?.summary).toBe(
      'JWKS endpoint',
    );
  });

  it('resource server introspection 계약은 Basic 인증과 active/inactive 응답 union을 문서화한다', () => {
    const document: { paths: Record<string, any> } = { paths: {} };

    applyEndpointReference(document);

    const operation =
      document.paths['/t/{tenantCode}/oidc/token/introspection'].post;
    expect(operation.security).toEqual([{ 'resource-server-basic': [] }]);
    const schema =
      operation.responses['200'].content['application/json'].schema;
    expect(schema.oneOf[0].required).toEqual(
      expect.arrayContaining([
        'active',
        'client_id',
        'token_type',
        'scope',
        'iss',
        'aud',
        'exp',
        'iat',
        'tenant_id',
      ]),
    );
    expect(schema.oneOf[1]).toMatchObject({
      additionalProperties: false,
      required: ['active'],
    });

    const requestSchema =
      operation.requestBody.content['application/x-www-form-urlencoded'].schema;
    expect(requestSchema.required).toEqual(['token']);
    expect(Object.keys(requestSchema.properties).sort()).toEqual([
      'token',
      'token_type_hint',
    ]);

    expect(
      operation.responses['401'].content['application/json'].examples,
    ).toEqual(
      expect.objectContaining({
        invalidClient: { value: { error: 'invalid_client' } },
      }),
    );
  });

  it('introspection document response schemas distinguish valid active and exact inactive payloads', () => {
    const document: { paths: Record<string, any> } = { paths: {} };
    applyEndpointReference(document);

    const schema =
      document.paths['/t/{tenantCode}/oidc/token/introspection'].post.responses[
        '200'
      ].content['application/json'].schema;
    const [active, inactive] = schema.oneOf;
    const activeResponse = {
      active: true,
      client_id: 'orders-api',
      token_type: 'Bearer',
      scope: 'orders:read',
      iss: 'https://auth.example.com/t/acme/oidc',
      aud: 'https://orders.example.com',
      exp: 1735689600,
      iat: 1735686000,
      tenant_id: 'tenant-acme',
      sub: 'user-123',
      jti: 'token-123',
      sid: 'session-123',
      cnf: { jkt: 'thumbprint' },
    };

    expect(
      active.required.every((claim: string) => claim in activeResponse),
    ).toBe(true);
    expect(active.properties.active.enum).toEqual([true]);
    expect(active.additionalProperties).toBe(false);
    expect(active.properties.aud.oneOf).toEqual([
      { type: 'string', format: 'uri' },
      { type: 'array', items: { type: 'string', format: 'uri' } },
    ]);
    expect(
      ['sub', 'jti', 'sid', 'cnf'].every((claim) => claim in active.properties),
    ).toBe(true);
    expect(active.required.includes('sub')).toBe(false);
    const incompleteActiveResponse = { ...activeResponse };
    delete (incompleteActiveResponse as { exp?: number }).exp;
    expect(
      active.required.every(
        (claim: string) => claim in incompleteActiveResponse,
      ),
    ).toBe(false);

    expect(inactive.properties.active.enum).toEqual([false]);
    expect(inactive.additionalProperties).toBe(false);
    expect(
      inactive.required.every((claim: string) => claim in { active: false }),
    ).toBe(true);
    expect(Object.keys(inactive.properties)).toEqual(['active']);
  });

  it('controller 기반 endpoint에는 ENDPOINTS 문서의 보안 설명을 operation description으로 병합한다', () => {
    const document: { paths: Record<string, any> } = {
      paths: {
        '/t/{tenantCode}/admin/clients': {
          get: {
            summary: 'List clients',
            responses: {},
          },
        },
        '/auth/password': {
          put: {
            summary: 'Change current user password',
            description: 'Existing description.',
            responses: {},
          },
        },
      },
    };

    applyEndpointReference(document);

    expect(
      document.paths['/t/{tenantCode}/admin/clients'].get.description,
    ).toContain('Redirect URIs are strictly validated');
    expect(document.paths['/auth/password'].put.description).toContain(
      'Existing description.',
    );
    expect(document.paths['/auth/password'].put.description).toContain(
      'Current password is verified',
    );
  });
});
