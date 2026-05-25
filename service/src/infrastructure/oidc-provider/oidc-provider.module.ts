import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OIDC_PROVIDER } from './oidc-provider.constants';
import { createOidcProvider } from './oidc-provider.factory';
import { AccessVerifierPort } from '@application/ports/access-verifier.port';
import { AccessVerifierAdapter } from './access-verifier.adapter';
import { MikroORM } from '@mikro-orm/core';
import Redis from 'ioredis';
import { ClientQueryPort } from '@application/queries/ports/client-query.port';
import { OidcProviderRegistry } from './oidc-provider.registry';
import { UserQueryPort } from '@application/queries/ports/user-query.port';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { REDIS, RedisModule } from '@infrastructure/redis/redis.module';
import { ApplicationModule } from '@application/application.module';
import {
  ClientRepository,
  ClientAuthPolicyRepository,
  EventRepository,
  JwksKeyRepository,
  TenantRepository,
  TenantConfigRepository,
} from '@domain/repositories';
import { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';
import { JwksKeyCryptoPort } from '@application/ports/jwks-key-crypto.port';
import { OperationalMetricsPort } from '@application/ports/operational-metrics.port';
import { InMemoryOperationalMetricsAdapter } from '@infrastructure/observability/in-memory-operational-metrics.adapter';
import { GrantTypeRegistryPort } from '@application/ports/grant-type-registry.port';
import { OidcGrantTypeRegistryAdapter } from './grant-type-registry.adapter';

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
        clientAuthPolicyRepository: ClientAuthPolicyRepository,
        tenantRepository: TenantRepository,
        tenantConfigRepository: TenantConfigRepository,
        jwksKeyRepository: JwksKeyRepository,
        eventRepository: EventRepository,
        jwksKeyCrypto: JwksKeyCryptoPort,
        symmetricCrypto: SymmetricCryptoPort,
        metrics: OperationalMetricsPort,
        grantTypeRegistry: GrantTypeRegistryPort,
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
            clientAuthPolicyRepository,
            tenantRepository,
            tenantConfigRepository,
            jwksKeyRepository,
            eventRepository,
            jwksKeyCrypto,
            symmetricCrypto,
            grantTypeRegistry,
          });
        }, metrics);

        return registry;
      },
      inject: [
        MikroORM,
        REDIS,
        UserQueryPort,
        ClientQueryPort,
        ConfigService,
        ClientRepository,
        ClientAuthPolicyRepository,
        TenantRepository,
        TenantConfigRepository,
        JwksKeyRepository,
        EventRepository,
        JwksKeyCryptoPort,
        SymmetricCryptoPort,
        OperationalMetricsPort,
        GrantTypeRegistryPort,
      ],
    },
    {
      provide: GrantTypeRegistryPort,
      useClass: OidcGrantTypeRegistryAdapter,
    },
    {
      provide: OperationalMetricsPort,
      useClass: InMemoryOperationalMetricsAdapter,
    },
    {
      provide: AccessVerifierPort,
      useClass: AccessVerifierAdapter,
    },
  ],
  exports: [
    OIDC_PROVIDER,
    AccessVerifierPort,
    OperationalMetricsPort,
    GrantTypeRegistryPort,
  ],
})
export class OidcProviderModule {}
