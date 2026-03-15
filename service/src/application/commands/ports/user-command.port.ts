import { CreateUserDto, UpdateUserDto } from '@application/dto';

export const USER_COMMAND_PORT = Symbol('USER_COMMAND_PORT');

export interface UserCommandPort {
  /**
   * Create a new user (admin)
   * @description 관리자에 의한 사용자 생성
   * @param tenantId - 테넌트 ID
   * @param dto - 사용자 생성 DTO
   * @returns 생성된 사용자 ID
   */
  createUser(tenantId: string, dto: CreateUserDto): Promise<{ id: string }>;

  /**
   * Update an existing user (admin)
   * @description 관리자에 의한 사용자 정보 수정
   * @param tenantId - 테넌트 ID
   * @param id - 사용자 ID
   * @param dto - 사용자 수정 DTO
   */
  updateUser(tenantId: string, id: string, dto: UpdateUserDto): Promise<void>;

  /**
   * Delete a user (admin)
   * @description 관리자에 의한 사용자 삭제
   * @param tenantId - 테넌트 ID
   * @param id - 사용자 ID
   */
  deleteUser(tenantId: string, id: string): Promise<void>;
}
