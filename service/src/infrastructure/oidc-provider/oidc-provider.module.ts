import {
  forwardRef,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { OIDC_PROVIDER } from './oidc-provider.constants';
import { createOidcProvider } from './oidc-provider.factory';
import { ACCESS_VERIFIER_PORT } from '@application/ports/access-verifier.port';
import { AccessVerifierAdapter } from './access-verifier.adapter';
import { MikroORM } from '@mikro-orm/core';
import Redis from 'ioredis';
import {
  ClientQueryPort,
  CLIENT_QUERY_PORT,
} from '@application/queries/ports/client-query.port';
import { TenantMiddleware } from '@presentation/http/tenant.middleware';
import { OidcDelegateMiddleware } from '@presentation/http/oidc.middleware';
import { OidcProviderRegistry } from './oidc-provider.registry';
import {
  USER_QUERY_PORT,
  UserQueryPort,
} from '@application/queries/ports/user-query.port';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { REDIS, RedisModule } from '@infrastructure/redis/redis.module';
import { ApplicationModule } from '@application/application.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([]),
    RedisModule,
    forwardRef(() => ApplicationModule),
  ],
  providers: [
    {
      provide: OIDC_PROVIDER,
      useFactory: (
        orm: MikroORM,
        redis: Redis,
        userQuery: UserQueryPort,
        clientQuery: ClientQueryPort,
      ) => {
        const base = process.env.OIDC_ISSUER;

        const registry = new OidcProviderRegistry((tenantCode) => {
          const issuer = `${base}/t/${tenantCode}/oidc`;

          return createOidcProvider({
            issuer,
            em: orm.em.fork(),
            redis,
            userQuery,
            clientQuery,
          });
        });

        return registry;
      },
      inject: [MikroORM, REDIS, USER_QUERY_PORT, CLIENT_QUERY_PORT],
    },
    {
      provide: ACCESS_VERIFIER_PORT,
      useClass: AccessVerifierAdapter,
    },
  ],
  exports: [OIDC_PROVIDER, ACCESS_VERIFIER_PORT],
})
export class OidcProviderModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware, OidcDelegateMiddleware).forRoutes({
      path: 't/:tenantCode/oidc',
      method: RequestMethod.ALL,
    });
  }
}
