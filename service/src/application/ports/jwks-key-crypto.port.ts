import type { KeyAlgorithm } from '@domain/models/jwks-key';

export interface GeneratedKeyPair {
  kid: string;
  algorithm: KeyAlgorithm;
  publicKeyPem: string;
  privateKeyEncrypted: string;
}

export abstract class JwksKeyCryptoPort {
  /**
   * RSA-2048 (RS256) 또는 EC P-256 (ES256) 키 쌍을 생성하고
   * 비공개 키를 암호화된 상태로 반환한다.
   */
  abstract generateKeyPair(algorithm?: KeyAlgorithm): Promise<GeneratedKeyPair>;
}
