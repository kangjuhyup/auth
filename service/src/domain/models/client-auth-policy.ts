import { Getter } from '../decorators';
import { PersistenceModel } from './persistence-model';

export type AuthMethod = 'password' | 'totp' | 'webauthn' | 'magic_link';
export type MfaMethod = 'totp' | 'webauthn' | 'recovery_code';
export type RefreshTokenReuseAction = 'revoke_grant';

interface ClientAuthPolicyModelProps {
  tenantId: string;
  clientRefId: string;
  allowedAuthMethods: AuthMethod[];
  defaultAcr: string;
  mfaRequired: boolean;
  allowedMfaMethods: MfaMethod[];
  maxSessionDurationSec: number | null;
  consentRequired: boolean;
  requireAuthTime: boolean;
  refreshTokenRotationEnabled: boolean;
  refreshTokenReuseAction: RefreshTokenReuseAction;
}

export class ClientAuthPolicyModel extends PersistenceModel<
  string,
  ClientAuthPolicyModelProps
> {
  constructor(props: ClientAuthPolicyModelProps, id?: string) {
    super(props, id);
  }

  @Getter()
  declare readonly tenantId: string;

  @Getter()
  declare readonly clientRefId: string;

  @Getter()
  declare readonly allowedAuthMethods: AuthMethod[];

  @Getter()
  declare readonly defaultAcr: string;

  @Getter()
  declare readonly mfaRequired: boolean;

  @Getter()
  declare readonly allowedMfaMethods: MfaMethod[];

  @Getter()
  declare readonly maxSessionDurationSec: number | null;

  @Getter()
  declare readonly consentRequired: boolean;

  @Getter()
  declare readonly requireAuthTime: boolean;

  @Getter()
  declare readonly refreshTokenRotationEnabled: boolean;

  @Getter()
  declare readonly refreshTokenReuseAction: RefreshTokenReuseAction;

  changeAllowedAuthMethods(methods: AuthMethod[]): void {
    this.etc.allowedAuthMethods = methods;
  }

  changeDefaultAcr(acr: string): void {
    this.etc.defaultAcr = acr;
  }

  changeMfaRequired(required: boolean): void {
    this.etc.mfaRequired = required;
  }

  changeAllowedMfaMethods(methods: MfaMethod[]): void {
    this.etc.allowedMfaMethods = methods;
  }

  changeMaxSessionDurationSec(sec: number | null): void {
    this.etc.maxSessionDurationSec = sec;
  }

  changeConsentRequired(required: boolean): void {
    this.etc.consentRequired = required;
  }

  changeRequireAuthTime(required: boolean): void {
    this.etc.requireAuthTime = required;
  }

  changeRefreshTokenRotationEnabled(enabled: boolean): void {
    this.etc.refreshTokenRotationEnabled = enabled;
  }

  changeRefreshTokenReuseAction(action: RefreshTokenReuseAction): void {
    this.etc.refreshTokenReuseAction = action;
  }
}
