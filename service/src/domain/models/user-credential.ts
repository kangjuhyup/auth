import { Getter } from '../decorators';
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

  static of(
    params: {
      type: CredentialType;
      secretHash: string;
      hashAlg: string;
      hashParams?: Record<string, unknown> | null;
      hashVersion?: number | null;
      enabled: boolean;
      expiresAt?: Date | null;
    },
    id?: string,
  ): UserCredentialModel {
    return new UserCredentialModel(params, id);
  }

  enable(): void {
    this.etc.enabled = true;
  }

  disable(): void {
    this.etc.enabled = false;
  }

  updateHashParams(params: Record<string, unknown>): void {
    this.etc.hashParams = params;
  }

  @Getter()
  declare readonly type: CredentialType;

  @Getter()
  declare readonly secretHash: string;

  @Getter()
  declare readonly hashAlg: string;

  @Getter()
  declare readonly hashParams: Record<string, unknown> | null | undefined;

  @Getter()
  declare readonly hashVersion: number | null | undefined;

  @Getter()
  declare readonly enabled: boolean;

  @Getter()
  declare readonly expiresAt: Date | null | undefined;
}
