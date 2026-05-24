import { Inject, Injectable } from '@nestjs/common';
import { Logging, LogLevel } from '@kangjuhyup/rvlog';
import type { CacheProvider } from '@node-saml/node-saml';
import type Redis from 'ioredis';
import { REDIS } from '@infrastructure/redis/redis.module';
import { RedisSamlCacheProvider } from './redis-saml-cache.provider';

@Injectable()
@Logging({ level: LogLevel.DEBUG })
export class RedisSamlCacheProviderFactory {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  create(params: { keyPrefix: string; ttlSeconds: number }): CacheProvider {
    return new RedisSamlCacheProvider(
      this.redis,
      params.keyPrefix,
      params.ttlSeconds,
    );
  }
}
