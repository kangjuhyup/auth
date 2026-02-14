import { Module } from '@nestjs/common';
import { EventStoreModule } from './event-store/event-store.module';
import { OidcProviderModule } from './oidc-provider/oidc-provider.module';
import { TENANT_REPOSITORY } from '@domain/repositories';
import { TenantRepositoryImpl } from './repositories/tenant.repository.impl';

@Module({
  imports: [EventStoreModule, OidcProviderModule],
  providers: [
    {
      provide: TENANT_REPOSITORY,
      useClass: TenantRepositoryImpl,
    },
  ],
  exports: [EventStoreModule, OidcProviderModule, TENANT_REPOSITORY],
})
export class InfrastructureModule {}
