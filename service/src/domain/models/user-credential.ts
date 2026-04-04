import { PersistenceModel } from './persistence-model';

export type CredentialType = 'password' | 'totp' | 'webauthn' | 'recovery_code';

interface UserCredentialProps {
  type: CredentialType;
  secretHash: string;

  hashAlg: string;
  hashParams?: Record<string, unknown> | null;
  hashVersion?: number | null;

  enabled: boolean;
  expiresAt?: Date | null;
}

export class UserCredentialModel extends PersistenceModel<
  string,
  UserCredentialProps
> {
  private constructor(props: UserCredentialProps, id?: string) {
    super(props, id);
  }

  static password(params: {
    secretHash: string;
    hashAlg: string;
    hashParams?: Record<string, unknown> | null;
    hashVersion?: number | null;
  }): UserCredentialModel {
    if (!params.secretHash) throw new Error('SecretHashRequired');
    if (!params.hashAlg) throw new Error('HashAlgRequired');

    return new UserCredentialModel({
      type: 'password',
      secretHash: params.secretHash,
      hashAlg: params.hashAlg,
      hashParams: params.hashParams,
      hashVersion: params.hashVersion,
      enabled: true,
    });
  }

  static of(params: {
    type: CredentialType;
    secretHash: string;
    hashAlg: string;
    hashParams?: Record<string, unknown> | null;
    hashVersion?: number | null;
    enabled: boolean;
    expiresAt?: Date | null;
  }, id?: string): UserCredentialModel {
    return new UserCredentialModel(params, id);
  }

  disable(): void {
    this.etc.enabled = false;
  }

  updateHashParams(params: Record<string, unknown>): void {
    this.etc.hashParams = params;
  }

  get type(): CredentialType {
    return this.etc.type;
  }
  get secretHash(): string {
    return this.etc.secretHash;
  }

  get hashAlg(): string {
    return this.etc.hashAlg;
  }
  get hashParams(): Record<string, unknown> | null | undefined {
    return this.etc.hashParams;
  }
  get hashVersion(): number | null | undefined {
    return this.etc.hashVersion;
  }

  get enabled(): boolean {
    return this.etc.enabled;
  }
  get expiresAt(): Date | null | undefined {
    return this.etc.expiresAt;
  }
}
