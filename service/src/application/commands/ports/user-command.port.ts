import { AuditContext, CreateUserDto, UpdateUserDto } from '@application/dto';

export abstract class UserCommandPort {
  /**
   * Create a new user (admin)
   * @description 관리자에 의한 사용자 생성
   */
  abstract createUser(
    tenantId: string,
    dto: CreateUserDto,
    auditContext?: AuditContext,
  ): Promise<{ id: string }>;

  /**
   * Update an existing user (admin)
   * @description 관리자에 의한 사용자 정보 수정
   */
  abstract updateUser(
    tenantId: string,
    id: string,
    dto: UpdateUserDto,
    auditContext?: AuditContext,
  ): Promise<void>;

  /**
   * Delete a user (admin)
   * @description 관리자에 의한 사용자 삭제
   */
  abstract deleteUser(
    tenantId: string,
    id: string,
    auditContext?: AuditContext,
  ): Promise<void>;

  /**
   * Assign a role to a user
   * @description 사용자에게 역할 할당
   */
  abstract assignRole(
    tenantId: string,
    userId: string,
    roleId: string,
    auditContext?: AuditContext,
  ): Promise<void>;

  /**
   * Remove a role from a user
   * @description 사용자에서 역할 제거
   */
  abstract removeRole(
    tenantId: string,
    userId: string,
    roleId: string,
    auditContext?: AuditContext,
  ): Promise<void>;

  abstract revokeUserSession(
    tenantId: string,
    userId: string,
    sessionId: string,
    auditContext?: AuditContext,
  ): Promise<void>;

  abstract revokeUserSessions(
    tenantId: string,
    userId: string,
    auditContext?: AuditContext,
  ): Promise<void>;
}
