import { AuditContext, CreateScopeDto, UpdateScopeDto } from '@application/dto';

export abstract class ScopeCommandPort {
  abstract createScope(
    tenantId: string,
    dto: CreateScopeDto,
    auditContext?: AuditContext,
  ): Promise<{ id: string }>;

  abstract updateScope(
    tenantId: string,
    id: string,
    dto: UpdateScopeDto,
    auditContext?: AuditContext,
  ): Promise<void>;

  abstract deleteScope(
    tenantId: string,
    id: string,
    auditContext?: AuditContext,
  ): Promise<void>;
}
