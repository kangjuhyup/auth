import { CreatePermissionDto, UpdatePermissionDto } from '@application/dto';

export const PERMISSION_COMMAND_PORT = Symbol('PERMISSION_COMMAND_PORT');

export interface PermissionCommandPort {
  /**
   * Create a new permission
   * @description 퍼미션 생성
   * @param tenantId - 테넌트 ID
   * @param dto - 퍼미션 생성 DTO
   * @returns 생성된 퍼미션 ID
   */
  createPermission(
    tenantId: string,
    dto: CreatePermissionDto,
  ): Promise<{ id: string }>;

  /**
   * Update an existing permission
   * @description 퍼미션 정보 수정
   * @param tenantId - 테넌트 ID
   * @param id - 퍼미션 ID
   * @param dto - 퍼미션 수정 DTO
   */
  updatePermission(
    tenantId: string,
    id: string,
    dto: UpdatePermissionDto,
  ): Promise<void>;

  /**
   * Delete a permission
   * @description 퍼미션 삭제
   * @param tenantId - 테넌트 ID
   * @param id - 퍼미션 ID
   */
  deletePermission(tenantId: string, id: string): Promise<void>;
}
