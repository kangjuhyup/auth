import Provider from 'oidc-provider';
import type { EntityManager } from '@mikro-orm/core';
import type Redis from 'ioredis';
import type { AccountQueryPort } from '@application/queries/ports/account-query.port';
import { buildOidcConfiguration } from './oidc-provider.config';
import { ClientQueryPort } from '@application/queries/ports/client-query.port';

export type CreateOidcProviderParams = {
  issuer: string;
  em: EntityManager;
  redis: Redis;
  accountQuery: AccountQueryPort;
  clientQuery: ClientQueryPort;
};

export function createOidcProvider(params: CreateOidcProviderParams): Provider {
  const configuration = buildOidcConfiguration({
    em: params.em,
    redis: params.redis,
    accountQuery: params.accountQuery,
    clientQuery: params.clientQuery,
  });

  return new Provider(params.issuer, configuration);
}
