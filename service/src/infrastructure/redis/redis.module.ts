// redis.module.ts
import { Module } from '@nestjs/common';
import Redis from 'ioredis';
export const REDIS = Symbol('REDIS');

@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: () =>
        new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379'),
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}
