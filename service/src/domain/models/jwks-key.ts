export type KeyStatus = 'active' | 'rotated' | 'revoked';
export type KeyAlgorithm = 'RS256' | 'ES256';

interface JwksKeyModelProps {
  kid: string;
  tenantId: string;
  algorithm: KeyAlgorithm;
  publicKey: string;
  privateKeyEnc: string;
  status: KeyStatus;
  rotatedAt?: Date | null;
  expiresAt?: Date | null;
  createdAt: Date;
}

export class JwksKeyModel {
  private props: JwksKeyModelProps;

  constructor(props: JwksKeyModelProps) {
    this.props = { ...props };
  }

  get kid(): string { return this.props.kid; }
  get tenantId(): string { return this.props.tenantId; }
  get algorithm(): KeyAlgorithm { return this.props.algorithm; }
  get publicKey(): string { return this.props.publicKey; }
  get privateKeyEnc(): string { return this.props.privateKeyEnc; }
  get status(): KeyStatus { return this.props.status; }
  get rotatedAt(): Date | null | undefined { return this.props.rotatedAt; }
  get expiresAt(): Date | null | undefined { return this.props.expiresAt; }
  get createdAt(): Date { return this.props.createdAt; }

  /**
   * 키를 rotated 상태로 전환하고 오버랩 만료시각을 설정한다.
   * overlapWindowMs: rotated 키가 검증에 사용되는 유예 기간 (기본 24시간)
   */
  markRotated(now: Date = new Date(), overlapWindowMs = 24 * 60 * 60 * 1000): void {
    this.props.status = 'rotated';
    this.props.rotatedAt = now;
    this.props.expiresAt = new Date(now.getTime() + overlapWindowMs);
  }
}
