import {
  AuditContext,
  CreateTenantDto,
  UpdateTenantDto,
} from '@application/dto';
import type { BuiltInOidcScope } from '@domain/models/scope';

export abstract class TenantCommandPort {
  /**
   * Create a new tenant
   * @description 신규 테넌트 생성
   */
  abstract createTenant(
    dto: CreateTenantDto,
    auditContext?: AuditContext,
  ): Promise<{ id: string }>;

  abstract ensureBuiltInScopes(
    tenantId: string,
    scopeNames: readonly BuiltInOidcScope[],
    auditContext?: AuditContext,
  ): Promise<void>;

  /**
   * Update an existing tenant
   * @description 테넌트 정보 수정
   */
  abstract updateTenant(
    id: string,
    dto: UpdateTenantDto,
    auditContext?: AuditContext,
  ): Promise<void>;

  /**
   * Delete a tenant
   * @description 테넌트 삭제
   */
  abstract deleteTenant(id: string, auditContext?: AuditContext): Promise<void>;
}
