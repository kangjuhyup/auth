import { CreateUserDto, UpdateUserDto } from '@application/dto';

export abstract class UserCommandPort {
  /**
   * Create a new user (admin)
   * @description 관리자에 의한 사용자 생성
   */
  abstract createUser(tenantId: string, dto: CreateUserDto): Promise<{ id: string }>;

  /**
   * Update an existing user (admin)
   * @description 관리자에 의한 사용자 정보 수정
   */
  abstract updateUser(tenantId: string, id: string, dto: UpdateUserDto): Promise<void>;

  /**
   * Delete a user (admin)
   * @description 관리자에 의한 사용자 삭제
   */
  abstract deleteUser(tenantId: string, id: string): Promise<void>;
}
