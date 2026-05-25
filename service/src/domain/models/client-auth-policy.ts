import { Getter } from '../decorators';
import { PersistenceModel } from './persistence-model';
import type {
  LoginSessionMode,
  SessionConflictAction,
  TenantPolicySet,
} from './tenant-policy';

export type AuthMethod = 'password' | 'totp' | 'webauthn' | 'magic_link';
export type MfaMethod = 'totp' | 'webauthn' | 'recovery_code';
export type RefreshTokenReuseAction = 'revoke_grant';
export type ClientLoginSessionModeOverride = Extract<
  LoginSessionMode,
  'single'
> | null;

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
  loginSessionMode?: ClientLoginSessionModeOverride;
  maxConcurrentSessions?: number | null;
  sessionConflictAction?: SessionConflictAction | null;
}

export interface EffectiveClientAuthPolicy {
  mfaRequired: boolean;
  allowedIdpProviderKeys: string[] | null;
  maxSessionDurationSec: number | null;
  requireAuthTime: boolean;
  reauthenticationIntervalSec: number | null;
  refreshTokenTtlSec: number;
  loginSessionMode: LoginSessionMode;
  maxConcurrentSessions: number | null;
  sessionConflictAction: SessionConflictAction;
}

export class ClientAuthPolicyModel extends PersistenceModel<
  string,
  ClientAuthPolicyModelProps
> {
  constructor(props: ClientAuthPolicyModelProps, id?: string) {
    super(
      {
        ...props,
        loginSessionMode: props.loginSessionMode ?? null,
        maxConcurrentSessions: props.maxConcurrentSessions ?? null,
        sessionConflictAction: props.sessionConflictAction ?? null,
      },
      id,
    );
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

  @Getter()
  declare readonly loginSessionMode: ClientLoginSessionModeOverride;

  @Getter()
  declare readonly maxConcurrentSessions: number | null;

  @Getter()
  declare readonly sessionConflictAction: SessionConflictAction | null;

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

  changeLoginSessionMode(mode: ClientLoginSessionModeOverride): void {
    this.etc.loginSessionMode = mode;
  }

  changeMaxConcurrentSessions(count: number | null): void {
    this.etc.maxConcurrentSessions = count;
  }

  changeSessionConflictAction(action: SessionConflictAction | null): void {
    this.etc.sessionConflictAction = action;
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
      loginSessionMode:
        tenantPolicies.session.loginSessionMode === 'single' ||
        this.loginSessionMode === 'single'
          ? 'single'
          : 'multi',
      maxConcurrentSessions: resolveStricterSessionLimit(
        tenantPolicies.session.maxConcurrentSessions,
        this.maxConcurrentSessions,
      ),
      sessionConflictAction:
        this.sessionConflictAction ??
        tenantPolicies.session.sessionConflictAction,
    };
  }
}

function resolveStricterSessionLimit(
  tenantLimit: number | null,
  clientLimit: number | null,
): number | null {
  if (tenantLimit === null) return clientLimit;
  if (clientLimit === null) return tenantLimit;
  return Math.min(tenantLimit, clientLimit);
}
