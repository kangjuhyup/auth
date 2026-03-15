import { CreateRoleDto, UpdateRoleDto } from '@application/dto';

export const ROLE_COMMAND_PORT = Symbol('ROLE_COMMAND_PORT');

export interface RoleCommandPort {
  /**
   * Create a new role
   * @description 역할 생성
   * @param tenantId - 테넌트 ID
   * @param dto - 역할 생성 DTO
   * @returns 생성된 역할 ID
   */
  createRole(tenantId: string, dto: CreateRoleDto): Promise<{ id: string }>;

  /**
   * Update an existing role
   * @description 역할 정보 수정
   * @param tenantId - 테넌트 ID
   * @param id - 역할 ID
   * @param dto - 역할 수정 DTO
   */
  updateRole(tenantId: string, id: string, dto: UpdateRoleDto): Promise<void>;

  /**
   * Delete a role
   * @description 역할 삭제
   * @param tenantId - 테넌트 ID
   * @param id - 역할 ID
   */
  deleteRole(tenantId: string, id: string): Promise<void>;
}
