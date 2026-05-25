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
