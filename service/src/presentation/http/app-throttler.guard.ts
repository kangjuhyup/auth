import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Logger, LogLevel, logAtLevel } from '@kangjuhyup/rvlog';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';

const OIDC_PATH = /^\/t\/[^/]+\/oidc(?:\/|$)/;
const OIDC_TOKEN_PATH = /^\/t\/[^/]+\/oidc\/token$/;

/**
 * OIDC·헬스·정적 자산 경로는 전역 레이트 리밋에서 제외한다.
 * (토큰 엔드포인트는 Ingress/WAF 쪽 제한을 권장)
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(AppThrottlerGuard.name);

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  protected override async shouldSkip(
    context: ExecutionContext,
  ): Promise<boolean> {
    if (context.getType() !== 'http') {
      this.logDecision('NON_HTTP', 'unknown', 'skipped', 'non_http_context');
      return true;
    }
    const req = context.switchToHttp().getRequest<{ path?: string }>();
    const path = req.path ?? '';
    if (
      path === '/health' ||
      path.startsWith('/health/') ||
      path === '/ready' ||
      path === '/metrics'
    ) {
      this.logDecision('HTTP', path, 'skipped', 'operational_endpoint');
      return true;
    }
    if (OIDC_TOKEN_PATH.test(path)) {
      this.logDecision('HTTP', path, 'included', 'oidc_token_endpoint');
      return false;
    }
    if (OIDC_PATH.test(path)) {
      this.logDecision('HTTP', path, 'skipped', 'oidc_provider_endpoint');
      return true;
    }
    if (path.startsWith('/interaction-assets')) {
      this.logDecision('HTTP', path, 'skipped', 'static_asset');
      return true;
    }
    this.logDecision('HTTP', path, 'included', 'default_policy');
    return false;
  }

  private logDecision(
    method: string,
    path: string,
    decision: 'included' | 'skipped',
    reason: string,
  ): void {
    logAtLevel(
      this.logger,
      LogLevel.DEBUG,
      `${method} ${path} ${decision} reason=${reason}`,
    );
  }
}
