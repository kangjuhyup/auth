import {
  forwardRef,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { OIDC_PROVIDER } from './oidc-provider.constants';
import { createOidcProvider } from './oidc-provider.factory';
import { AccessVerifierPort } from '@application/ports/access-verifier.port';
import { AccessVerifierAdapter } from './access-verifier.adapter';
import { MikroORM } from '@mikro-orm/core';
import Redis from 'ioredis';
import { ClientQueryPort } from '@application/queries/ports/client-query.port';
import { TenantMiddleware } from '@presentation/http/tenant.middleware';
import { OidcDelegateMiddleware } from '@presentation/http/oidc.middleware';
import { OidcProviderRegistry } from './oidc-provider.registry';
import { UserQueryPort } from '@application/queries/ports/user-query.port';
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
      inject: [MikroORM, REDIS, UserQueryPort, ClientQueryPort],
    },
    {
      provide: AccessVerifierPort,
      useClass: AccessVerifierAdapter,
    },
  ],
  exports: [OIDC_PROVIDER, AccessVerifierPort],
})
export class OidcProviderModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware, OidcDelegateMiddleware).forRoutes({
      path: 't/:tenantCode/oidc',
      method: RequestMethod.ALL,
    });
  }
}
