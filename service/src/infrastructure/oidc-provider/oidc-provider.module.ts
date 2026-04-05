import {
  forwardRef,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { ClientRepository, JwksKeyRepository, TenantRepository, TenantConfigRepository } from '@domain/repositories';
import { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';
import { JwksKeyCryptoPort } from '@application/ports/jwks-key-crypto.port';

@Module({
  imports: [
    ConfigModule,
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
        configService: ConfigService,
        clientRepository: ClientRepository,
        tenantRepository: TenantRepository,
        tenantConfigRepository: TenantConfigRepository,
        jwksKeyRepository: JwksKeyRepository,
        jwksKeyCrypto: JwksKeyCryptoPort,
        symmetricCrypto: SymmetricCryptoPort,
      ) => {
        const base = configService.getOrThrow<string>('OIDC_ISSUER');

        const registry = new OidcProviderRegistry((tenantCode) => {
          const issuer = `${base}/t/${tenantCode}/oidc`;

          return createOidcProvider({
            issuer,
            em: orm.em.fork(),
            redis,
            userQuery,
            clientQuery,
            configService,
            tenantCode,
            clientRepository,
            tenantRepository,
            tenantConfigRepository,
            jwksKeyRepository,
            jwksKeyCrypto,
            symmetricCrypto,
          });
        });

        return registry;
      },
      inject: [
        MikroORM,
        REDIS,
        UserQueryPort,
        ClientQueryPort,
        ConfigService,
        ClientRepository,
        TenantRepository,
        TenantConfigRepository,
        JwksKeyRepository,
        JwksKeyCryptoPort,
        SymmetricCryptoPort,
      ],
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
    consumer.apply(TenantMiddleware, OidcDelegateMiddleware).forRoutes(
      {
        path: 't/:tenantCode/oidc',
        method: RequestMethod.ALL,
      },
      {
        path: 't/:tenantCode/oidc/*path',
        method: RequestMethod.ALL,
      },
    );

    // interaction/* 은 `.../interaction/:uid/api/details` 처럼 여러 세그먼트라
    // path 와일드카드 한 개로는 TenantMiddleware 가 안 탈 수 있음.
    // TenantMiddleware 는 PresentationModule 에서 InteractionController 전체에 적용한다.
  }
}
