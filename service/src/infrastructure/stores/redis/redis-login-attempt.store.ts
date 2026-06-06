import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type Redis from 'ioredis';
import type { LoginAttemptParams } from '@application/ports/login-attempt-policy.port';
import { REDIS } from '@infrastructure/redis/redis.module';

@Injectable()
export class RedisLoginAttemptStore {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async incrementIpCounter(
    params: LoginAttemptParams,
    ttlSec: number,
  ): Promise<number> {
    return this.incrementExpiring(this.ipKey(params), ttlSec);
  }

  async getIpCounterTtl(
    params: LoginAttemptParams,
    fallbackSec: number,
  ): Promise<number> {
    return this.ttlOrDefault(this.ipKey(params), fallbackSec);
  }

  async hasLock(params: LoginAttemptParams): Promise<boolean> {
    return (await this.redis.get(this.lockKey(params))) !== null;
  }

  async getLockTtl(
    params: LoginAttemptParams,
    fallbackSec: number,
  ): Promise<number> {
    return this.ttlOrDefault(this.lockKey(params), fallbackSec);
  }

  async incrementFailureCounter(
    params: LoginAttemptParams,
    ttlSec: number,
  ): Promise<number> {
    return this.incrementExpiring(this.failureKey(params), ttlSec);
  }

  async setLock(params: LoginAttemptParams, ttlSec: number): Promise<void> {
    await this.redis.set(this.lockKey(params), '1', 'EX', ttlSec);
  }

  async clearFailureCounter(params: LoginAttemptParams): Promise<void> {
    await this.redis.del(this.failureKey(params));
  }

  async clearFailureAndLock(params: LoginAttemptParams): Promise<void> {
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
}
