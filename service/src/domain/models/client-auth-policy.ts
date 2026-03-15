import { PersistenceModel } from './persistence-model';

export type AuthMethod = 'password' | 'totp' | 'webauthn' | 'magic_link';
export type MfaMethod = 'totp' | 'webauthn' | 'recovery_code';

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
}

export class ClientAuthPolicyModel extends PersistenceModel<
  string,
  ClientAuthPolicyModelProps
> {
  constructor(props: ClientAuthPolicyModelProps, id?: string) {
    super(props, id);
  }

  get tenantId(): string {
    return this.etc.tenantId;
  }

  get clientRefId(): string {
    return this.etc.clientRefId;
  }

  get allowedAuthMethods(): AuthMethod[] {
    return this.etc.allowedAuthMethods;
  }

  get defaultAcr(): string {
    return this.etc.defaultAcr;
  }

  get mfaRequired(): boolean {
    return this.etc.mfaRequired;
  }

  get allowedMfaMethods(): MfaMethod[] {
    return this.etc.allowedMfaMethods;
  }

  get maxSessionDurationSec(): number | null {
    return this.etc.maxSessionDurationSec;
  }

  get consentRequired(): boolean {
    return this.etc.consentRequired;
  }

  get requireAuthTime(): boolean {
    return this.etc.requireAuthTime;
  }

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
}
