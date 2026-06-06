import { UserIdentityModel } from '../models/user-identity';

export abstract class UserIdentityRepository {
  abstract findByProviderSub(
    tenantId: string,
    provider: string,
    providerSub: string,
  ): Promise<UserIdentityModel | null>;

  abstract findByIdForUser(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<UserIdentityModel | null>;

  abstract listByUser(
    tenantId: string,
    userId: string,
  ): Promise<UserIdentityModel[]>;

  abstract save(model: UserIdentityModel): Promise<UserIdentityModel>;

  abstract delete(id: string): Promise<void>;
}
