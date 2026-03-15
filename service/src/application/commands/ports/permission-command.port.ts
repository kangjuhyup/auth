import { CreatePermissionDto, UpdatePermissionDto } from '@application/dto';

export abstract class PermissionCommandPort {
  /**
   * Create a new permission
   * @description 퍼미션 생성
   */
  abstract createPermission(
    tenantId: string,
    dto: CreatePermissionDto,
  ): Promise<{ id: string }>;

  /**
   * Update an existing permission
   * @description 퍼미션 정보 수정
   */
  abstract updatePermission(
    tenantId: string,
    id: string,
    dto: UpdatePermissionDto,
  ): Promise<void>;

  /**
   * Delete a permission
   * @description 퍼미션 삭제
   */
  abstract deletePermission(tenantId: string, id: string): Promise<void>;
}
