import { Getter } from '../decorators';
import { PersistenceModel } from './persistence-model';
import { UserCredentialModel } from './user-credential';

export type UserStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED' | 'WITHDRAWN';

interface UserProps {
  tenantId: string;
  username: string;
  email?: string | null;
  emailVerified: boolean;
  phone?: string | null;
  phoneVerified: boolean;
  status: UserStatus;
  mfaEnabled: boolean;
  passwordCredential?: UserCredentialModel;
}

export class UserModel extends PersistenceModel<string, UserProps> {
  private constructor(props: UserProps, id: string) {
    super(props, id);
  }

  /* ==============================
     Factories
  =============================== */

  static create(params: {
    id: string;
    tenantId: string;
    username: string;
    email?: string | null;
    phone?: string | null;
    passwordCredential: UserCredentialModel;
  }): UserModel {
    return new UserModel(
      {
        tenantId: params.tenantId,
        username: params.username.trim(),
        email: params.email ?? null,
        emailVerified: false,
        phone: params.phone ?? null,
        phoneVerified: false,
        status: 'ACTIVE',
        mfaEnabled: false,
        passwordCredential: params.passwordCredential,
      },
      params.id,
    );
  }

  static of(params: {
    id: string;
    tenantId: string;
    username: string;
    email?: string | null;
    emailVerified: boolean;
    phone?: string | null;
    phoneVerified: boolean;
    status: UserStatus;
    mfaEnabled?: boolean;
    passwordCredential?: UserCredentialModel;
  }): UserModel {
    return new UserModel(
      {
        tenantId: params.tenantId,
        username: params.username,
        email: params.email ?? null,
        emailVerified: params.emailVerified,
        phone: params.phone ?? null,
        phoneVerified: params.phoneVerified,
        status: params.status,
        mfaEnabled: params.mfaEnabled ?? false,
        passwordCredential: params.passwordCredential,
      },
      params.id,
    );
  }

  /* ==============================
     Commands (Domain behaviors)
  =============================== */

  withdraw(): void {
    if (this.status === 'WITHDRAWN') throw new Error('AlreadyWithdrawn');
    this.etc.status = 'WITHDRAWN';
  }

  changePassword(newCredential: UserCredentialModel): void {
    if (this.status === 'WITHDRAWN') throw new Error('UserAlreadyWithdrawn');
    this.etc.passwordCredential = newCredential;
  }

  getPasswordCredential(): UserCredentialModel {
    const c = this.etc.passwordCredential;
    if (!c) throw new Error('PasswordCredentialNotFound');
    return c;
  }

  changeEmail(email: string | null): void {
    if (this.status === 'WITHDRAWN') throw new Error('UserAlreadyWithdrawn');
    this.etc.email = email;
    this.etc.emailVerified = false;
  }

  verifyEmail(): void {
    if (this.status === 'WITHDRAWN') throw new Error('UserAlreadyWithdrawn');
    if (!this.email) throw new Error('EmailNotSet');
    this.etc.emailVerified = true;
  }

  changePhone(phone: string | null): void {
    if (this.status === 'WITHDRAWN') throw new Error('UserAlreadyWithdrawn');
    this.etc.phone = phone;
    this.etc.phoneVerified = false;
  }

  verifyPhone(): void {
    if (this.status === 'WITHDRAWN') throw new Error('UserAlreadyWithdrawn');
    if (!this.phone) throw new Error('PhoneNotSet');
    this.etc.phoneVerified = true;
  }

  changeStatus(status: UserStatus): void {
    if (this.status === 'WITHDRAWN') throw new Error('UserAlreadyWithdrawn');
    this.etc.status = status;
  }

  changeMfaEnabled(enabled: boolean): void {
    if (this.status === 'WITHDRAWN') throw new Error('UserAlreadyWithdrawn');
    this.etc.mfaEnabled = enabled;
  }

  /* ==============================
     Getters
  =============================== */

  @Getter()
  declare readonly tenantId: string;

  @Getter()
  declare readonly username: string;

  @Getter()
  declare readonly email: string | null | undefined;

  @Getter()
  declare readonly emailVerified: boolean;

  @Getter()
  declare readonly phone: string | null | undefined;

  @Getter()
  declare readonly phoneVerified: boolean;

  @Getter()
  declare readonly status: UserStatus;

  @Getter()
  declare readonly mfaEnabled: boolean;

  @Getter()
  declare readonly passwordCredential: UserCredentialModel | undefined;
}
