import { Getter } from '../decorators';
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

  @Getter()
  declare readonly tenantId: string;

  @Getter()
  declare readonly userId: string;

  @Getter()
  declare readonly provider: IdpProvider;

  @Getter()
  declare readonly providerSub: string;

  @Getter()
  declare readonly email: string | null | undefined;

  @Getter()
  declare readonly profileJson: Record<string, unknown> | null | undefined;

  @Getter()
  declare readonly linkedAt: Date;
}
