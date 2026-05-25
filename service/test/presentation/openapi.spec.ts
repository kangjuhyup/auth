import { ConfigService } from '@nestjs/config';
import {
  createRedocHtml,
  shouldEnableOpenApiDocs,
} from '@presentation/openapi';
import {
  OpenApiResponseSchemas,
  paginatedSchema,
} from '@presentation/openapi-response';

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

  it('Redoc HTML은 OpenAPI spec URL을 참조한다', () => {
    const html = createRedocHtml('/openapi.json');

    expect(html).toContain('<redoc spec-url="/openapi.json"></redoc>');
    expect(html).toContain('redoc.standalone.js');
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
});
