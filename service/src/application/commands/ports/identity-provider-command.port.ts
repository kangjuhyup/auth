import {
  AuditContext,
  CreateIdentityProviderDto,
  UpdateIdentityProviderDto,
} from '@application/dto';

export abstract class IdentityProviderCommandPort {
  abstract createIdentityProvider(
    tenantId: string,
    dto: CreateIdentityProviderDto,
    auditContext?: AuditContext,
  ): Promise<{ id: string }>;

  abstract updateIdentityProvider(
    tenantId: string,
    id: string,
    dto: UpdateIdentityProviderDto,
    auditContext?: AuditContext,
  ): Promise<void>;

  abstract deleteIdentityProvider(
    tenantId: string,
    id: string,
    auditContext?: AuditContext,
  ): Promise<void>;
}
