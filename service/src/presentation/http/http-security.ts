import helmet from 'helmet';
import type { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { buildHelmetOptions } from './security-headers.config';

/**
 * Express 레벨 보안: trust proxy, X-Powered-By 제거, Helmet.
 * 환경 변수는 모두 선택이며, 기본값은 로컬 개발에 무해하게 잡는다.
 */
export function applyHttpSecurityMiddleware(
  app: NestExpressApplication,
  config: ConfigService,
): void {
  app.disable('x-powered-by');

  const hopsRaw = config.get<string>('HTTP_TRUST_PROXY_HOPS')?.trim();
  if (hopsRaw !== undefined && hopsRaw !== '') {
    const n = Number(hopsRaw);
    if (!Number.isNaN(n) && n >= 0) {
      app.set('trust proxy', n === 0 ? false : n);
    }
  }

  if (config.get<string>('HTTP_HELMET_ENABLED', 'true') === 'false') {
    return;
  }

  const hstsEnabled = config.get<string>('HTTP_HSTS_ENABLED', 'false') === 'true';
  const hstsMaxAgeSec = Number(config.get('HTTP_HSTS_MAX_AGE_SEC', '15552000'));

  app.use(helmet(buildHelmetOptions({ hstsEnabled, hstsMaxAgeSec })));
}
