import type { HelmetOptions } from 'helmet';

/**
 * OIDC 리다이렉트·interaction·정적 자산과 충돌을 줄이기 위해 CSP 는 끈다.
 * (프론트를 Nest 가 직접 서빙하고 정책을 통제할 수 있을 때만 별도로 설계)
 */
export function buildHelmetOptions(params: {
  hstsEnabled: boolean;
  hstsMaxAgeSec: number;
}): HelmetOptions {
  return {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    originAgentCluster: true,
    hsts: params.hstsEnabled
      ? { maxAge: params.hstsMaxAgeSec, includeSubDomains: true, preload: false }
      : false,
    ieNoOpen: true,
    noSniff: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: false,
    frameguard: { action: 'sameorigin' },
    hidePoweredBy: true,
  };
}
