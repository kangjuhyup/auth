import Provider from 'oidc-provider';
import type { EntityManager } from '@mikro-orm/core';
import type Redis from 'ioredis';
import { buildOidcConfiguration } from './oidc-provider.config';
import { ClientQueryPort } from '@application/queries/ports/client-query.port';
import { UserQueryPort } from '@application/queries/ports/user-query.port';

export type CreateOidcProviderParams = {
  issuer: string;
  em: EntityManager;
  redis: Redis;
  userQuery: UserQueryPort;
  clientQuery: ClientQueryPort;
};

export function createOidcProvider(params: CreateOidcProviderParams): Provider {
  const configuration = buildOidcConfiguration({
    em: params.em,
    redis: params.redis,
    userQuery: params.userQuery,
    clientQuery: params.clientQuery,
  });

  return new Provider(params.issuer, configuration);
}
