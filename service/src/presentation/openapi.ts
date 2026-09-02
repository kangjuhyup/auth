import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { applyEndpointReference } from './openapi-endpoints';

const OPENAPI_JSON_PATH = '/openapi.json';
const LOCAL_DOCS_ORIGINS = ['http://localhost:3100', 'http://127.0.0.1:3100'];

type RequestLike = {
  headers?: {
    origin?: string | string[];
  };
};

type ResponseLike = {
  setHeader?: (name: string, value: string) => void;
  header?: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

export function shouldEnableOpenApiDocs(config: ConfigService): boolean {
  const explicit = config.get<string>('OPENAPI_DOCS_ENABLED');
  if (explicit !== undefined) {
    return explicit.trim().toLowerCase() === 'true';
  }

  return config.get<string>('NODE_ENV') !== 'production';
}

function csv(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '' && item !== '*');
}

export function resolveOpenApiCorsOrigin(
  config: ConfigService,
  requestOrigin?: string | string[],
): string | undefined {
  const origin = Array.isArray(requestOrigin)
    ? requestOrigin[0]
    : requestOrigin;
  if (!origin) {
    return undefined;
  }

  const configuredOrigins = csv(config.get<string>('OPENAPI_CORS_ORIGINS'));
  const allowedOrigins =
    configuredOrigins.length > 0
      ? configuredOrigins
      : config.get<string>('NODE_ENV') === 'production'
        ? []
        : LOCAL_DOCS_ORIGINS;

  return allowedOrigins.includes(origin) ? origin : undefined;
}

function applyOpenApiCorsHeaders(
  config: ConfigService,
  request: RequestLike,
  response: ResponseLike,
): void {
  const origin = resolveOpenApiCorsOrigin(config, request.headers?.origin);
  if (!origin) {
    return;
  }

  const setHeader = response.setHeader ?? response.header;
  setHeader?.call(response, 'Access-Control-Allow-Origin', origin);
  setHeader?.call(response, 'Vary', 'Origin');
}

export function configureOpenApiDocs(app: INestApplication): void {
  const config = app.get(ConfigService);
  if (!shouldEnableOpenApiDocs(config)) {
    return;
  }

  const document = createOpenApiDocument(app);
  const adapter = app.getHttpAdapter();

  adapter.get(OPENAPI_JSON_PATH, (request, response: ResponseLike) => {
    applyOpenApiCorsHeaders(config, request, response);
    response.json(document);
  });
}

export function createOpenApiDocument(app: INestApplication) {
  const openApiConfig = new DocumentBuilder()
    .setTitle('Auth API')
    .setDescription('OIDC Authorization Server API Reference')
    .setVersion('0.1.1')
    .addServer('/', 'Service origin')
    .addServer('/api', 'Vite proxy')
    .addSecurity('access-token', {
      type: 'http',
      scheme: 'bearer',
    })
    .addBasicAuth({ type: 'http', scheme: 'basic' }, 'resource-server-basic')
    .addCookieAuth('admin_session', {
      type: 'apiKey',
      in: 'cookie',
      name: 'admin_session',
    })
    .build();

  const document = SwaggerModule.createDocument(app, openApiConfig);
  applyEndpointReference(document);
  return document;
}
