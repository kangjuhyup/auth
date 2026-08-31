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
  CustomGrantRepository,
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
import { ScopeRegistryPort } from '@application/ports/scope-registry.port';
import { OidcScopeRegistryAdapter } from './scope-registry.adapter';
import { ScopeClaimResolverPort } from '@application/ports/scope-claim-resolver.port';
import { OidcScopeClaimResolverAdapter } from './scope-claim-resolver.adapter';
import { OidcSessionControlService } from './session/oidc-session-control.service';
import { UserSessionPort } from '@application/ports/user-session.port';

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
        customGrantRepository: CustomGrantRepository,
        jwksKeyCrypto: JwksKeyCryptoPort,
        symmetricCrypto: SymmetricCryptoPort,
        metrics: OperationalMetricsPort,
        grantTypeRegistry: GrantTypeRegistryPort,
        scopeRegistry: ScopeRegistryPort,
        scopeClaimResolver: ScopeClaimResolverPort,
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
            customGrantRepository,
            jwksKeyCrypto,
            symmetricCrypto,
            grantTypeRegistry,
            scopeRegistry,
            scopeClaimResolver,
            metrics,
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
        CustomGrantRepository,
        JwksKeyCryptoPort,
        SymmetricCryptoPort,
        OperationalMetricsPort,
        GrantTypeRegistryPort,
        ScopeRegistryPort,
        ScopeClaimResolverPort,
      ],
    },
    {
      provide: GrantTypeRegistryPort,
      useClass: OidcGrantTypeRegistryAdapter,
    },
    {
      provide: ScopeRegistryPort,
      useClass: OidcScopeRegistryAdapter,
    },
    {
      provide: ScopeClaimResolverPort,
      useClass: OidcScopeClaimResolverAdapter,
    },
    {
      provide: OperationalMetricsPort,
      useClass: InMemoryOperationalMetricsAdapter,
    },
    {
      provide: AccessVerifierPort,
      useClass: AccessVerifierAdapter,
    },
    OidcSessionControlService,
    {
      provide: UserSessionPort,
      useExisting: OidcSessionControlService,
    },
  ],
  exports: [
    OIDC_PROVIDER,
    AccessVerifierPort,
    OperationalMetricsPort,
    GrantTypeRegistryPort,
    ScopeRegistryPort,
    ScopeClaimResolverPort,
    OidcSessionControlService,
    UserSessionPort,
  ],
})
export class OidcProviderModule {}
