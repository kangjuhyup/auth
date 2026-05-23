import { Getter } from '../decorators';

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

  updatePolicies(policies: Record<string, unknown>): void {
    this.props.extra = { ...(this.props.extra ?? {}), policies };
  }

  getPolicies(): Record<string, unknown> {
    return (this.props.extra?.['policies'] as Record<string, unknown>) ?? {};
  }
}
