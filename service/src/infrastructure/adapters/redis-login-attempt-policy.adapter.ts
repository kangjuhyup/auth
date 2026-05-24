import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type Redis from 'ioredis';
import {
  LoginAttemptPolicyPort,
  type LoginAttemptDecision,
  type LoginAttemptFailureResult,
  type LoginAttemptParams,
} from '@application/ports/login-attempt-policy.port';
import { REDIS } from '@infrastructure/redis/redis.module';

@Injectable()
export class RedisLoginAttemptPolicyAdapter extends LoginAttemptPolicyPort {
  private readonly ipLimit: number;
  private readonly ipWindowSec: number;
  private readonly failureLimit: number;
  private readonly failureWindowSec: number;
  private readonly lockTtlSec: number;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
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
    const ipCount = await this.incrementExpiring(
      this.ipKey(params),
      this.ipWindowSec,
    );
    if (ipCount > this.ipLimit) {
      return {
        allowed: false,
        reason: 'rate_limited',
        retryAfterSec: await this.ttlOrDefault(
          this.ipKey(params),
          this.ipWindowSec,
        ),
      };
    }

    const lockKey = this.lockKey(params);
    const isLocked = await this.redis.get(lockKey);
    if (isLocked) {
      return {
        allowed: false,
        reason: 'temporarily_locked',
        retryAfterSec: await this.ttlOrDefault(lockKey, this.lockTtlSec),
      };
    }

    return { allowed: true };
  }

  async recordFailure(
    params: LoginAttemptParams,
  ): Promise<LoginAttemptFailureResult> {
    const failureKey = this.failureKey(params);
    const failureCount = await this.incrementExpiring(
      failureKey,
      this.failureWindowSec,
    );

    if (failureCount < this.failureLimit) {
      return { failureCount, temporarilyLocked: false };
    }

    const lockKey = this.lockKey(params);
    await this.redis.set(lockKey, '1', 'EX', this.lockTtlSec);
    await this.redis.del(failureKey);

    return {
      failureCount,
      temporarilyLocked: true,
      retryAfterSec: this.lockTtlSec,
    };
  }

  async recordSuccess(params: LoginAttemptParams): Promise<void> {
    await this.redis.del(this.failureKey(params), this.lockKey(params));
  }

  private async incrementExpiring(
    key: string,
    ttlSec: number,
  ): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, ttlSec);
    }
    return count;
  }

  private async ttlOrDefault(
    key: string,
    fallbackSec: number,
  ): Promise<number> {
    const ttl = await this.redis.ttl(key);
    return ttl > 0 ? ttl : fallbackSec;
  }

  private ipKey(params: LoginAttemptParams): string {
    return `login:ip:${params.scope}:${this.hash(params.ipAddress ?? 'unknown')}`;
  }

  private failureKey(params: LoginAttemptParams): string {
    return `login:failure:${params.scope}:${this.subjectKey(params)}`;
  }

  private lockKey(params: LoginAttemptParams): string {
    return `login:lock:${params.scope}:${this.subjectKey(params)}`;
  }

  private subjectKey(params: LoginAttemptParams): string {
    return `${this.hash(params.tenantId)}:${this.hash(
      params.username.trim().toLowerCase(),
    )}`;
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
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
