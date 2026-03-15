import type { EntityManager } from '@mikro-orm/core';
import type Redis from 'ioredis';
import type Provider from 'oidc-provider';
import { ConfigService } from '@nestjs/config';
import { buildOidcConfiguration } from './oidc-provider.config';
import { ClientQueryPort } from '@application/queries/ports/client-query.port';
import { UserQueryPort } from '@application/queries/ports/user-query.port';
import { loadOidcProviderConstructor } from './oidc-provider.loader';
import type { ClientRepository, TenantRepository } from '@domain/repositories';
import type { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';

export type CreateOidcProviderParams = {
  issuer: string;
  em: EntityManager;
  redis: Redis;
  userQuery: UserQueryPort;
  clientQuery: ClientQueryPort;
  configService: ConfigService;
  tenantCode: string;
  clientRepository: ClientRepository;
  tenantRepository: TenantRepository;
  symmetricCrypto: SymmetricCryptoPort;
};

export async function createOidcProvider(
  params: CreateOidcProviderParams,
): Promise<Provider> {
  const configuration = buildOidcConfiguration({
    em: params.em,
    redis: params.redis,
    userQuery: params.userQuery,
    clientQuery: params.clientQuery,
    configService: params.configService,
    tenantCode: params.tenantCode,
    clientRepository: params.clientRepository,
    tenantRepository: params.tenantRepository,
    symmetricCrypto: params.symmetricCrypto,
  });

  const Provider = await loadOidcProviderConstructor();

  return new Provider(params.issuer, configuration);
}
