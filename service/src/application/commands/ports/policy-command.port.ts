export abstract class PolicyCommandPort {
  /**
   * Update security policies for a tenant
   * @description 테넌트 보안 정책 수정 (PKCE 필수, 허용 grant 등)
   */
  abstract updatePolicies(
    tenantId: string,
    policies: Record<string, unknown>,
  ): Promise<void>;
}
