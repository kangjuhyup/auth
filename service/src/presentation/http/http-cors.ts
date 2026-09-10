import type { ConfigService } from '@nestjs/config';
import type {
  CorsOptions,
  CorsOptionsDelegate,
} from '@nestjs/common/interfaces/external/cors-options.interface';
import type { ExternalInteractionUiPort } from '@application/ports/external-interaction-ui.port';

const EXTERNAL_INTERACTION_API_PATH =
  /^\/t\/([a-z0-9-]{1,64})\/interaction\/([A-Za-z0-9_-]{8,128})\/api(?:\/|$)/;

export function buildHttpCorsDelegate(
  config: ConfigService,
  externalInteractionUi: ExternalInteractionUiPort,
): CorsOptionsDelegate<Record<string, any>> {
  const staticOrigins = new Set(resolveStaticOrigins(config));

  return (request, callback) => {
    void resolveCorsOptions(request, staticOrigins, externalInteractionUi).then(
      (options) => callback(null, options),
      () => callback(null, { origin: false }),
    );
  };
}

async function resolveCorsOptions(
  request: Record<string, any>,
  staticOrigins: ReadonlySet<string>,
  externalInteractionUi: ExternalInteractionUiPort,
): Promise<CorsOptions> {
  const origin = header(request, 'origin');
  if (!origin) return { origin: false };
  if (staticOrigins.has(origin)) {
    return { origin, credentials: true };
  }

  const path = String(request.originalUrl ?? request.url ?? '').split('?')[0];
  const match = EXTERNAL_INTERACTION_API_PATH.exec(path);
  if (!match) return { origin: false };

  const allowedOrigin = await externalInteractionUi.resolveCorsOrigin({
    tenantCode: match[1],
    uid: match[2],
  });
  if (allowedOrigin !== origin) return { origin: false };

  return {
    origin,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Interaction-CSRF',
      'X-Correlation-ID',
    ],
    maxAge: 300,
  };
}

function resolveStaticOrigins(config: ConfigService): string[] {
  const rawOrigins =
    config.get<string>('HTTP_CORS_ORIGINS') ??
    config.get<string>('ADMIN_UI_URL');
  if (!rawOrigins) return [];
  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '' && origin !== '*');
}

function header(
  request: Record<string, any>,
  name: string,
): string | undefined {
  const value = request.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}
