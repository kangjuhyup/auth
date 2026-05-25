import {
  AuditContext,
  CreateCustomGrantDto,
  UpdateCustomGrantDto,
} from '@application/dto';

export abstract class CustomGrantCommandPort {
  abstract createCustomGrant(
    tenantId: string,
    dto: CreateCustomGrantDto,
    auditContext?: AuditContext,
  ): Promise<{ id: string }>;

  abstract updateCustomGrant(
    tenantId: string,
    id: string,
    dto: UpdateCustomGrantDto,
    auditContext?: AuditContext,
  ): Promise<void>;

  abstract deleteCustomGrant(
    tenantId: string,
    id: string,
    auditContext?: AuditContext,
  ): Promise<void>;
}
