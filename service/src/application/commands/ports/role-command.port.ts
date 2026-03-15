import { CreateRoleDto, UpdateRoleDto } from '@application/dto';

export abstract class RoleCommandPort {
  /**
   * Create a new role
   * @description 역할 생성
   */
  abstract createRole(tenantId: string, dto: CreateRoleDto): Promise<{ id: string }>;

  /**
   * Update an existing role
   * @description 역할 정보 수정
   */
  abstract updateRole(tenantId: string, id: string, dto: UpdateRoleDto): Promise<void>;

  /**
   * Delete a role
   * @description 역할 삭제
   */
  abstract deleteRole(tenantId: string, id: string): Promise<void>;
}
