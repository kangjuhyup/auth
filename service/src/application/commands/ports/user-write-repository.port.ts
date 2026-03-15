import { UserModel } from '@domain/models/user';

export const USER_WRITE_REPOSITORY_PORT = Symbol('USER_WRITE_REPOSITORY_PORT');

export interface UserWriteRepositoryPort {
  findById(id: string): Promise<UserModel | undefined>;
  findByUsername(
    tenantId: string,
    username: string,
  ): Promise<UserModel | undefined>;
  findByContact(
    tenantId: string,
    params: { email?: string; phone?: string },
  ): Promise<UserModel | undefined>;
  save(user: UserModel): Promise<void>;
}
