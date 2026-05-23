import { Getter } from '../decorators';

export interface ConsentModelProps {
  tenantId: string;
  userId: string;
  clientRefId: string;
  clientId?: string;
  clientName?: string;
  grantedScopes: string;
  grantedAt: Date;
  revokedAt?: Date | null;
}

export class ConsentModel {
  private props: ConsentModelProps;
  private _id?: string;

  constructor(props: ConsentModelProps, id?: string) {
    this.props = { ...props };
    this._id = id;
  }

  get id(): string | undefined {
    return this._id;
  }

  @Getter()
  declare readonly tenantId: string;

  @Getter()
  declare readonly userId: string;

  @Getter()
  declare readonly clientRefId: string;

  @Getter()
  declare readonly clientId: string | undefined;

  @Getter()
  declare readonly clientName: string | undefined;

  @Getter()
  declare readonly grantedScopes: string;

  @Getter()
  declare readonly grantedAt: Date;

  @Getter()
  declare readonly revokedAt: Date | null | undefined;

  get isRevoked(): boolean {
    return !!this.props.revokedAt;
  }

  revoke(at: Date = new Date()): void {
    this.props.revokedAt = at;
  }

  setId(id: string): void {
    this._id = id;
  }
}
