import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const OPENAPI_JSON_PATH = '/openapi.json';
const REDOC_PATH = '/redoc';

export function shouldEnableOpenApiDocs(config: ConfigService): boolean {
  const explicit = config.get<string>('OPENAPI_DOCS_ENABLED');
  if (explicit !== undefined) {
    return explicit.trim().toLowerCase() === 'true';
  }

  return config.get<string>('NODE_ENV') !== 'production';
}

export function createRedocHtml(specUrl = OPENAPI_JSON_PATH): string {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Auth API Reference</title>
    <style>
      body { margin: 0; padding: 0; }
      redoc { display: block; min-height: 100vh; }
    </style>
  </head>
  <body>
    <redoc spec-url="${specUrl}"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`;
}

export function configureOpenApiDocs(app: INestApplication): void {
  const config = app.get(ConfigService);
  if (!shouldEnableOpenApiDocs(config)) {
    return;
  }

  const openApiConfig = new DocumentBuilder()
    .setTitle('Auth API')
    .setDescription('OIDC Authorization Server API Reference')
    .setVersion('0.1.1')
    .addServer('/', 'Service origin')
    .addServer('/api', 'Vite proxy')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .addCookieAuth('admin_session', {
      type: 'apiKey',
      in: 'cookie',
      name: 'admin_session',
    })
    .build();

  const document = SwaggerModule.createDocument(app, openApiConfig);
  const adapter = app.getHttpAdapter();

  adapter.get(OPENAPI_JSON_PATH, (_request, response) => {
    response.json(document);
  });

  adapter.get(REDOC_PATH, (_request, response) => {
    response.type('html').send(createRedocHtml(OPENAPI_JSON_PATH));
  });
}
