import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '@infrastructure/redis/redis.module';

export type SamlRelayStateRef = {
  tenantId: string;
  provider: string;
  relayState: string;
};

@Injectable()
export class RedisSamlRelayStateStore {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async save(ref: SamlRelayStateRef, ttlSeconds: number): Promise<void> {
    await this.redis.set(this.key(ref), '1', 'EX', ttlSeconds);
  }

  async exists(ref: SamlRelayStateRef): Promise<boolean> {
    return (await this.redis.get(this.key(ref))) !== null;
  }

  async delete(ref: SamlRelayStateRef): Promise<void> {
    await this.redis.del(this.key(ref));
  }

  private key(ref: SamlRelayStateRef): string {
    return `saml:relay:${ref.tenantId}:${ref.provider}:${ref.relayState}`;
  }
}
