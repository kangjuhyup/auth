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

  get tenantId(): string {
    return this.props.tenantId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get clientRefId(): string {
    return this.props.clientRefId;
  }

  get clientId(): string | undefined {
    return this.props.clientId;
  }

  get clientName(): string | undefined {
    return this.props.clientName;
  }

  get grantedScopes(): string {
    return this.props.grantedScopes;
  }

  get grantedAt(): Date {
    return this.props.grantedAt;
  }

  get revokedAt(): Date | null | undefined {
    return this.props.revokedAt;
  }

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
