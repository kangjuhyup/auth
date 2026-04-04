import { UserIdentityModel } from '../models/user-identity';

export abstract class UserIdentityRepository {
  abstract findByProviderSub(
    tenantId: string,
    provider: string,
    providerSub: string,
  ): Promise<UserIdentityModel | null>;

  abstract save(model: UserIdentityModel): Promise<UserIdentityModel>;
}
