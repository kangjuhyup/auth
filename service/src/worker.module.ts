import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EntityManager } from '@mikro-orm/core';
import { resolve } from 'node:path';
import { buildMikroOrmConfig } from './infrastructure/mikro-orm/config/mikro-orm.config';
import { readOidcCleanupOptions } from './infrastructure/oidc-provider/cleanup/oidc-cleanup.config';
import { OidcCleanupStore } from './infrastructure/oidc-provider/cleanup/oidc-cleanup.store';
import { OidcCleanupWorker } from './infrastructure/oidc-provider/cleanup/oidc-cleanup.worker';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), 'service/.env'),
        resolve(process.cwd(), '.env'),
      ],
    }),
    MikroOrmModule.forRoot({
      // ConfigModule above has already loaded .env into the process environment.
      ...buildMikroOrmConfig({ get: (key) => process.env[key] }),
      // Dedicated maintenance connection budget; no HTTP/Redis/provider bootstrap.
      pool: { min: 0, max: 1, acquireTimeoutMillis: 5_000 },
      debug: false,
      logger: () => undefined,
      registerRequestContext: false,
    }),
  ],
  providers: [
    {
      provide: OidcCleanupWorker,
      inject: [EntityManager, ConfigService],
      useFactory: (em: EntityManager, config: ConfigService) =>
        new OidcCleanupWorker(
          new OidcCleanupStore(em),
          readOidcCleanupOptions((key) => config.get<string>(key)),
        ),
    },
  ],
})
export class WorkerModule {}
