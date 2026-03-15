export const POLICY_COMMAND_PORT = Symbol('POLICY_COMMAND_PORT');

export interface PolicyCommandPort {
  /**
   * Update security policies for a tenant
   * @description 테넌트 보안 정책 수정 (PKCE 필수, 허용 grant 등)
   * @param tenantId - 테넌트 ID
   * @param policies - 정책 설정 객체
   */
  updatePolicies(
    tenantId: string,
    policies: Record<string, unknown>,
  ): Promise<void>;
}
