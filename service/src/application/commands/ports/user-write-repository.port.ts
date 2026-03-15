import { UserModel } from '@domain/models/user';

export abstract class UserWriteRepositoryPort {
  abstract findById(id: string): Promise<UserModel | undefined>;
  abstract findByUsername(
    tenantId: string,
    username: string,
  ): Promise<UserModel | undefined>;
  abstract findByContact(
    tenantId: string,
    params: { email?: string; phone?: string },
  ): Promise<UserModel | undefined>;
  abstract save(user: UserModel): Promise<void>;
}
