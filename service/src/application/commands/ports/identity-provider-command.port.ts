import {
  CreateIdentityProviderDto,
  UpdateIdentityProviderDto,
} from '@application/dto';

export abstract class IdentityProviderCommandPort {
  abstract createIdentityProvider(
    tenantId: string,
    dto: CreateIdentityProviderDto,
  ): Promise<{ id: string }>;

  abstract updateIdentityProvider(
    tenantId: string,
    id: string,
    dto: UpdateIdentityProviderDto,
  ): Promise<void>;

  abstract deleteIdentityProvider(tenantId: string, id: string): Promise<void>;
}
