import type { EntityManager } from '@mikro-orm/core';
import type Redis from 'ioredis';
import type Provider from 'oidc-provider';
import { ConfigService } from '@nestjs/config';
import { buildOidcConfiguration } from './oidc-provider.config';
import { ClientQueryPort } from '@application/queries/ports/client-query.port';
import { UserQueryPort } from '@application/queries/ports/user-query.port';
import { loadOidcProviderConstructor } from './oidc-provider.loader';

export type CreateOidcProviderParams = {
  issuer: string;
  em: EntityManager;
  redis: Redis;
  userQuery: UserQueryPort;
  clientQuery: ClientQueryPort;
  configService: ConfigService;
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
  });

  const Provider = await loadOidcProviderConstructor();

  return new Provider(params.issuer, configuration);
}
