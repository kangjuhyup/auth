import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';

const OIDC_PATH = /^\/t\/[^/]+\/oidc(?:\/|$)/;

/**
 * OIDC·헬스·정적 자산 경로는 전역 레이트 리밋에서 제외한다.
 * (토큰 엔드포인트는 Ingress/WAF 쪽 제한을 권장)
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const req = context.switchToHttp().getRequest<{ path?: string }>();
    const path = req.path ?? '';
    if (path === '/health' || path.startsWith('/health/')) {
      return true;
    }
    if (OIDC_PATH.test(path)) {
      return true;
    }
    if (path.startsWith('/interaction-assets')) {
      return true;
    }
    return false;
  }
}
