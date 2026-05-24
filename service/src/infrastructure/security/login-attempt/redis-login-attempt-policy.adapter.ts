import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LoginAttemptPolicyPort,
  type LoginAttemptDecision,
  type LoginAttemptFailureResult,
  type LoginAttemptParams,
} from '@application/ports/login-attempt-policy.port';
import { RedisLoginAttemptStore } from '@infrastructure/stores/redis/redis-login-attempt.store';

@Injectable()
export class RedisLoginAttemptPolicyAdapter extends LoginAttemptPolicyPort {
  private readonly ipLimit: number;
  private readonly ipWindowSec: number;
  private readonly failureLimit: number;
  private readonly failureWindowSec: number;
  private readonly lockTtlSec: number;

  constructor(
    private readonly loginAttemptStore: RedisLoginAttemptStore,
    config: ConfigService,
  ) {
    super();
    this.ipLimit = this.getNumber(config, 'LOGIN_RATE_LIMIT_IP_MAX', 10);
    this.ipWindowSec = this.getNumber(
      config,
      'LOGIN_RATE_LIMIT_IP_WINDOW_SEC',
      60,
    );
    this.failureLimit = this.getNumber(config, 'LOGIN_FAILURE_MAX', 5);
    this.failureWindowSec = this.getNumber(
      config,
      'LOGIN_FAILURE_WINDOW_SEC',
      15 * 60,
    );
    this.lockTtlSec = this.getNumber(config, 'LOGIN_LOCK_TTL_SEC', 15 * 60);
  }

  async consumeAttempt(
    params: LoginAttemptParams,
  ): Promise<LoginAttemptDecision> {
    const ipCount = await this.loginAttemptStore.incrementIpCounter(
      params,
      this.ipWindowSec,
    );
    if (ipCount > this.ipLimit) {
      return {
        allowed: false,
        reason: 'rate_limited',
        retryAfterSec: await this.loginAttemptStore.getIpCounterTtl(
          params,
          this.ipWindowSec,
        ),
      };
    }

    const isLocked = await this.loginAttemptStore.hasLock(params);
    if (isLocked) {
      return {
        allowed: false,
        reason: 'temporarily_locked',
        retryAfterSec: await this.loginAttemptStore.getLockTtl(
          params,
          this.lockTtlSec,
        ),
      };
    }

    return { allowed: true };
  }

  async recordFailure(
    params: LoginAttemptParams,
  ): Promise<LoginAttemptFailureResult> {
    const failureCount = await this.loginAttemptStore.incrementFailureCounter(
      params,
      this.failureWindowSec,
    );

    if (failureCount < this.failureLimit) {
      return { failureCount, temporarilyLocked: false };
    }

    await this.loginAttemptStore.setLock(params, this.lockTtlSec);
    await this.loginAttemptStore.clearFailureCounter(params);

    return {
      failureCount,
      temporarilyLocked: true,
      retryAfterSec: this.lockTtlSec,
    };
  }

  async recordSuccess(params: LoginAttemptParams): Promise<void> {
    await this.loginAttemptStore.clearFailureAndLock(params);
  }

  private getNumber(
    config: ConfigService,
    key: string,
    defaultValue: number,
  ): number {
    const value = Number(config.get<string>(key) ?? defaultValue);
    return Number.isFinite(value) && value > 0 ? value : defaultValue;
  }
}
