import { CreateGroupDto, UpdateGroupDto } from '@application/dto';

export abstract class GroupCommandPort {
  /**
   * Create a new group
   * @description 그룹 생성
   */
  abstract createGroup(tenantId: string, dto: CreateGroupDto): Promise<{ id: string }>;

  /**
   * Update an existing group
   * @description 그룹 정보 수정
   */
  abstract updateGroup(tenantId: string, id: string, dto: UpdateGroupDto): Promise<void>;

  /**
   * Delete a group
   * @description 그룹 삭제
   */
  abstract deleteGroup(tenantId: string, id: string): Promise<void>;
}
