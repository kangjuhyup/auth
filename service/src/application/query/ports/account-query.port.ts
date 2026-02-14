export const ACCOUNT_QUERY_PORT = Symbol('ACCOUNT_QUERY_PORT');

export type AccountClaimsView = Readonly<{
  sub: string;
  email?: string | null;
  email_verified?: boolean;
  // 필요한 claim만 추가
}>;

export interface AccountQueryPort {
  findClaimsBySub(params: {
    tenantId: string;
    sub: string;
  }): Promise<AccountClaimsView | null>;
}
