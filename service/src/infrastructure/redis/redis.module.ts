// redis.module.ts
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  attachRedisConnectionErrorHandler,
  buildRedisConnectionConfig,
} from './redis.config';

export const REDIS = Symbol('REDIS');
const redisLogger = new Logger('RedisConnection');

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS,
      useFactory: (configService: ConfigService) => {
        const connection = buildRedisConnectionConfig(configService);
        const redis = connection.url
          ? new Redis(connection.url, connection.options)
          : new Redis(connection.options);
        attachRedisConnectionErrorHandler(redis, redisLogger);
        return redis;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}
