import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { KeyCommandPort } from '../ports/key-command.port';
import { TenantRepository, JwksKeyRepository } from '@domain/repositories';
import { JwksKeyCryptoPort } from '@application/ports/jwks-key-crypto.port';
import { JwksKeyModel } from '@domain/models/jwks-key';

@Injectable()
export class KeyCommandHandler implements KeyCommandPort {
  private readonly logger = new Logger(KeyCommandHandler.name);

  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly jwksKeyRepo: JwksKeyRepository,
    private readonly jwksKeyCrypto: JwksKeyCryptoPort,
  ) {}

  async rotateKeys(tenantId: string): Promise<void> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) throw new NotFoundException('Tenant not found');

    const now = new Date();

    // 1. 기존 active 키를 rotated 상태로 전환 (오버랩 윈도우 24시간 유지)
    const activeKeys = await this.jwksKeyRepo.findActiveByTenantId(tenantId);
    for (const key of activeKeys) {
      key.markRotated(now);
    }

    // 2. 새 RS256 키 쌍 생성 (비공개 키는 AES-256-GCM 암호화 상태로 반환)
    const kp = await this.jwksKeyCrypto.generateKeyPair('RS256');

    const newKey = new JwksKeyModel({
      kid: kp.kid,
      tenantId,
      algorithm: kp.algorithm,
      publicKey: kp.publicKeyPem,
      privateKeyEnc: kp.privateKeyEncrypted,
      status: 'active',
      rotatedAt: null,
      expiresAt: null,
      createdAt: now,
    });

    // 3. 기존 키 상태 업데이트 + 신규 키 저장을 한 트랜잭션에서 처리
    await this.jwksKeyRepo.saveMany([...activeKeys, newKey]);

    this.logger.log(
      `Rotated keys for tenant=${tenantId}: ${activeKeys.length} key(s) marked rotated, new kid=${kp.kid}`,
    );
  }
}
