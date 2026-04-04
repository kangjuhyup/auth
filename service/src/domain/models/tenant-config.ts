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

  get tenantId(): string {
    return this.props.tenantId;
  }

  get signupPolicy(): SignupPolicy {
    return this.props.signupPolicy;
  }

  get requirePhoneVerify(): boolean {
    return this.props.requirePhoneVerify;
  }

  get brandName(): string | null | undefined {
    return this.props.brandName;
  }

  get accessTokenTtlSec(): number {
    return this.props.accessTokenTtlSec;
  }

  get refreshTokenTtlSec(): number {
    return this.props.refreshTokenTtlSec;
  }

  get extra(): Record<string, unknown> | null | undefined {
    return this.props.extra;
  }

  updatePolicies(policies: Record<string, unknown>): void {
    this.props.extra = { ...(this.props.extra ?? {}), policies };
  }

  getPolicies(): Record<string, unknown> {
    return (this.props.extra?.['policies'] as Record<string, unknown>) ?? {};
  }
}
