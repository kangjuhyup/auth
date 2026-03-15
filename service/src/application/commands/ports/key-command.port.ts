export abstract class KeyCommandPort {
  /**
   * Rotate JWKS signing keys
   * @description JWKS 서명 키 로테이션. 기존 키는 rotated 상태로 오버랩 윈도우 유지
   */
  abstract rotateKeys(tenantId: string): Promise<void>;
}
