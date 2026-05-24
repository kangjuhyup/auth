import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import {
  IdentityLinkSessionPort,
  type IdentityLinkSession,
} from '@application/ports/identity-link-session.port';
import { REDIS } from '@infrastructure/redis/redis.module';

@Injectable()
export class RedisIdentityLinkSessionRepository extends IdentityLinkSessionPort {
  constructor(@Inject(REDIS) private readonly redis: Redis) {
    super();
  }

  async create(session: IdentityLinkSession, ttlSec: number): Promise<void> {
    await this.redis.set(
      this.key(session.state),
      JSON.stringify(session),
      'EX',
      ttlSec,
    );
  }

  async consume(state: string): Promise<IdentityLinkSession | null> {
    const key = this.key(state);
    const raw = await this.redis.get(key);
    if (!raw) {
      return null;
    }

    await this.redis.del(key);
    return JSON.parse(raw) as IdentityLinkSession;
  }

  private key(state: string): string {
    return `identity-link:state:${state}`;
  }
}
