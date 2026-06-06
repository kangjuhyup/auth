import { AuditContext, CreateRoleDto, UpdateRoleDto } from '@application/dto';

export abstract class RoleCommandPort {
  /**
   * Create a new role
   * @description 역할 생성
   */
  abstract createRole(
    tenantId: string,
    dto: CreateRoleDto,
    auditContext?: AuditContext,
  ): Promise<{ id: string }>;

  /**
   * Update an existing role
   * @description 역할 정보 수정
   */
  abstract updateRole(
    tenantId: string,
    id: string,
    dto: UpdateRoleDto,
    auditContext?: AuditContext,
  ): Promise<void>;

  /**
   * Delete a role
   * @description 역할 삭제
   */
  abstract deleteRole(
    tenantId: string,
    id: string,
    auditContext?: AuditContext,
  ): Promise<void>;

  /**
   * Add a permission to a role
   * @description 역할에 퍼미션 추가
   */
  abstract addPermissionToRole(
    tenantId: string,
    roleId: string,
    permissionId: string,
    auditContext?: AuditContext,
  ): Promise<void>;

  /**
   * Remove a permission from a role
   * @description 역할에서 퍼미션 제거
   */
  abstract removePermissionFromRole(
    tenantId: string,
    roleId: string,
    permissionId: string,
    auditContext?: AuditContext,
  ): Promise<void>;
}
