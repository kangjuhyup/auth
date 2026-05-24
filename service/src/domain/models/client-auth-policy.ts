import { Getter } from '../decorators';
import { PersistenceModel } from './persistence-model';
import type { TenantPolicySet } from './tenant-policy';

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
  allowedIdpProviderKeys: string[] | null;
  reauthenticationIntervalSec: number | null;
  refreshTokenRotationEnabled: boolean;
  refreshTokenReuseAction: RefreshTokenReuseAction;
}

export interface EffectiveClientAuthPolicy {
  mfaRequired: boolean;
  allowedIdpProviderKeys: string[] | null;
  maxSessionDurationSec: number | null;
  requireAuthTime: boolean;
  reauthenticationIntervalSec: number | null;
  refreshTokenTtlSec: number;
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
  declare readonly allowedIdpProviderKeys: string[] | null;

  @Getter()
  declare readonly reauthenticationIntervalSec: number | null;

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

  changeAllowedIdpProviderKeys(providerKeys: string[] | null): void {
    this.etc.allowedIdpProviderKeys = providerKeys;
  }

  changeReauthenticationIntervalSec(sec: number | null): void {
    this.etc.reauthenticationIntervalSec = sec;
  }

  changeRefreshTokenRotationEnabled(enabled: boolean): void {
    this.etc.refreshTokenRotationEnabled = enabled;
  }

  changeRefreshTokenReuseAction(action: RefreshTokenReuseAction): void {
    this.etc.refreshTokenReuseAction = action;
  }

  resolveEffectivePolicy(
    tenantPolicies: TenantPolicySet,
    clientRefreshTokenTtlSec: number | null | undefined,
  ): EffectiveClientAuthPolicy {
    return {
      mfaRequired: tenantPolicies.mfa.required || this.mfaRequired,
      allowedIdpProviderKeys:
        this.allowedIdpProviderKeys ?? tenantPolicies.allowedIdp.providerKeys,
      maxSessionDurationSec:
        this.maxSessionDurationSec ?? tenantPolicies.session.maxAgeSec,
      requireAuthTime:
        tenantPolicies.session.requireAuthTime || this.requireAuthTime,
      reauthenticationIntervalSec:
        this.reauthenticationIntervalSec ??
        tenantPolicies.session.reauthenticationIntervalSec,
      refreshTokenTtlSec:
        clientRefreshTokenTtlSec ?? tenantPolicies.refreshToken.ttlSec,
    };
  }
}
