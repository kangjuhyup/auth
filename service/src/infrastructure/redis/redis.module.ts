// redis.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
export const REDIS = Symbol('REDIS');

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS,
      useFactory: (configService: ConfigService) =>
        new Redis(configService.getOrThrow<string>('REDIS_URL')),
      inject: [ConfigService],
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}
