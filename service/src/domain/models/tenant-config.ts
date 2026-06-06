import { Getter } from '../decorators';
import {
  mergeTenantPolicySet,
  normalizeTenantPolicySet,
  type TenantPolicyInput,
  type TenantPolicySet,
} from './tenant-policy';

export type SignupPolicy = 'invite' | 'open';

interface TenantConfigModelProps {
  tenantId: string;
  signupPolicy: SignupPolicy;
  requirePhoneVerify: boolean;
  brandName?: string | null;
  accessTokenTtlSec: number;
  refreshTokenTtlSec: number;
  extra?: Record<string, unknown> | null;
}

export class TenantConfigModel {
  private props: TenantConfigModelProps;

  constructor(props: TenantConfigModelProps) {
    this.props = { ...props };
  }

  @Getter()
  declare readonly tenantId: string;

  @Getter()
  declare readonly signupPolicy: SignupPolicy;

  @Getter()
  declare readonly requirePhoneVerify: boolean;

  @Getter()
  declare readonly brandName: string | null | undefined;

  @Getter()
  declare readonly accessTokenTtlSec: number;

  @Getter()
  declare readonly refreshTokenTtlSec: number;

  @Getter()
  declare readonly extra: Record<string, unknown> | null | undefined;

  updatePolicies(policies: TenantPolicyInput): void {
    const nextPolicies = mergeTenantPolicySet(this.getPolicies(), policies);
    this.props.signupPolicy = nextPolicies.signup.mode;
    this.props.refreshTokenTtlSec = nextPolicies.refreshToken.ttlSec;
    this.props.extra = {
      ...(this.props.extra ?? {}),
      policies: nextPolicies,
    };
  }

  getPolicies(): TenantPolicySet {
    const policies = this.props.extra?.['policies'];
    return normalizeTenantPolicySet(
      policies && typeof policies === 'object' && !Array.isArray(policies)
        ? (policies as Record<string, unknown>)
        : null,
      {
        signupMode: this.props.signupPolicy,
        refreshTokenTtlSec: this.props.refreshTokenTtlSec,
      },
    );
  }
}
