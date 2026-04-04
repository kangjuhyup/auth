import { PersistenceModel } from './persistence-model';
import type { IdpProvider } from './identity-provider';

interface UserIdentityModelProps {
  tenantId: string;
  userId: string;
  provider: IdpProvider;
  providerSub: string;
  email?: string | null;
  profileJson?: Record<string, unknown> | null;
  linkedAt: Date;
}

export class UserIdentityModel extends PersistenceModel<
  string,
  UserIdentityModelProps
> {
  constructor(props: UserIdentityModelProps, id?: string) {
    super(props, id);
  }

  get tenantId(): string {
    return this.etc.tenantId;
  }
  get userId(): string {
    return this.etc.userId;
  }
  get provider(): IdpProvider {
    return this.etc.provider;
  }
  get providerSub(): string {
    return this.etc.providerSub;
  }
  get email(): string | null | undefined {
    return this.etc.email;
  }
  get profileJson(): Record<string, unknown> | null | undefined {
    return this.etc.profileJson;
  }
  get linkedAt(): Date {
    return this.etc.linkedAt;
  }
}
