import type { ConfigService } from '@nestjs/config';
import type { KoaContextWithOIDC } from 'oidc-provider';
import type {
  GrantTypeDefinition,
  GrantTypeName,
} from '@application/ports/grant-type-registry.port';
import type { ClientQueryPort } from '@application/queries/ports/client-query.port';
import type { UserQueryPort } from '@application/queries/ports/user-query.port';
import type { EventRepository } from '@domain/repositories';

export type CustomGrantTypeHandler = (
  ctx: KoaContextWithOIDC,
  next: () => Promise<void>,
) => void | Promise<void>;

export type CustomGrantTypeParameters = string | string[] | Set<string>;

export interface CustomGrantTypeContext {
  tenantCode: string;
  configService: ConfigService;
  userQuery: UserQueryPort;
  clientQuery: ClientQueryPort;
  eventRepository: EventRepository;
}

export interface CustomGrantTypeDefinition extends GrantTypeDefinition {
  grantType: GrantTypeName;
  builtIn: false;
  parameters?: CustomGrantTypeParameters;
  duplicateParameters?: CustomGrantTypeParameters;
  createHandler: (context: CustomGrantTypeContext) => CustomGrantTypeHandler;
}
