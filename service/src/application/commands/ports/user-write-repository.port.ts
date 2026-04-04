import { UserModel } from '@domain/models/user';
import { UserCredentialModel } from '@domain/models/user-credential';
import type { CredentialType } from '@domain/models/user-credential';

export interface UserListQuery {
  tenantId: string;
  page: number;
  limit: number;
}

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
  abstract list(
    query: UserListQuery,
  ): Promise<{ items: UserModel[]; total: number }>;
  abstract save(user: UserModel): Promise<void>;

  abstract findCredentialsByType(
    userId: string,
    types: CredentialType[],
  ): Promise<UserCredentialModel[]>;

  abstract saveCredential(credential: UserCredentialModel): Promise<void>;
}
