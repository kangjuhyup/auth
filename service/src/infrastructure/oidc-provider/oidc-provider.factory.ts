import type { EntityManager } from '@mikro-orm/core';
import type Redis from 'ioredis';
import type Provider from 'oidc-provider';
import { ConfigService } from '@nestjs/config';
import { buildOidcConfiguration } from './oidc-provider.config';
import { ClientQueryPort } from '@application/queries/ports/client-query.port';
import { UserQueryPort } from '@application/queries/ports/user-query.port';
import { loadOidcProviderConstructor } from './oidc-provider.loader';
import type { ClientRepository, TenantRepository, TenantConfigRepository } from '@domain/repositories';
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
  tenantConfigRepository: TenantConfigRepository;
  symmetricCrypto: SymmetricCryptoPort;
};

const DEFAULT_ACCESS_TOKEN_TTL = 60 * 60;
const DEFAULT_REFRESH_TOKEN_TTL = 14 * 24 * 60 * 60;

export async function createOidcProvider(
  params: CreateOidcProviderParams,
): Promise<Provider> {
  const tenant = await params.tenantRepository.findByCode(params.tenantCode);
  const tenantConfig = tenant
    ? await params.tenantConfigRepository.findByTenantId(tenant.id)
    : null;

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
    tenantAccessTokenTtlSec: tenantConfig?.accessTokenTtlSec ?? DEFAULT_ACCESS_TOKEN_TTL,
    tenantRefreshTokenTtlSec: tenantConfig?.refreshTokenTtlSec ?? DEFAULT_REFRESH_TOKEN_TTL,
  });

  const Provider = await loadOidcProviderConstructor();

  return new Provider(params.issuer, configuration);
}
