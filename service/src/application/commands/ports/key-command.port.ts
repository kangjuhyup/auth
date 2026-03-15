export const KEY_COMMAND_PORT = Symbol('KEY_COMMAND_PORT');

export interface KeyCommandPort {
  /**
   * Rotate JWKS signing keys
   * @description JWKS 서명 키 로테이션. 기존 키는 rotated 상태로 오버랩 윈도우 유지
   * @param tenantId - 테넌트 ID
   */
  rotateKeys(tenantId: string): Promise<void>;
}
