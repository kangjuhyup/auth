import { CreateGroupDto, UpdateGroupDto } from '@application/dto';

export const GROUP_COMMAND_PORT = Symbol('GROUP_COMMAND_PORT');

export interface GroupCommandPort {
  /**
   * Create a new group
   * @description 그룹 생성
   * @param tenantId - 테넌트 ID
   * @param dto - 그룹 생성 DTO
   * @returns 생성된 그룹 ID
   */
  createGroup(tenantId: string, dto: CreateGroupDto): Promise<{ id: string }>;

  /**
   * Update an existing group
   * @description 그룹 정보 수정
   * @param tenantId - 테넌트 ID
   * @param id - 그룹 ID
   * @param dto - 그룹 수정 DTO
   */
  updateGroup(tenantId: string, id: string, dto: UpdateGroupDto): Promise<void>;

  /**
   * Delete a group
   * @description 그룹 삭제
   * @param tenantId - 테넌트 ID
   * @param id - 그룹 ID
   */
  deleteGroup(tenantId: string, id: string): Promise<void>;
}
