import { Injectable } from '@nestjs/common';
import { EntityManager, LockMode } from '@mikro-orm/core';
import { OtpTokenOrmEntity } from '@infrastructure/mikro-orm/entities/otp-token';
import type {
  OtpTokenPort,
  OtpTokenRecord,
  OtpPurpose,
} from '@application/ports/otp-token.port';

@Injectable()
export class OtpTokenAdapter implements OtpTokenPort {
  constructor(private readonly em: EntityManager) {}

  async create(params: {
    tenantId: string;
    userId: string;
    purpose: OtpPurpose;
    requestId: string;
    tokenHash: string;
    issuedAt: Date;
    expiresAt: Date;
  }): Promise<void> {
    const entity = this.em.create(OtpTokenOrmEntity, {
      tenantId: params.tenantId,
      userId: params.userId,
      purpose: params.purpose,
      requestId: params.requestId,
      tokenHash: params.tokenHash,
      issuedAt: params.issuedAt,
      expiresAt: params.expiresAt,
      createdAt: new Date(),
    });
    this.em.persist(entity);
    await this.em.flush();
  }

  async findValidByTokenHash(params: {
    tenantId: string;
    purpose: OtpPurpose;
    tokenHash: string;
    now?: Date;
  }): Promise<OtpTokenRecord | undefined> {
    const now = params.now ?? new Date();

    // ✅ 동시 소비 경쟁 방지: PESSIMISTIC_WRITE로 잠금
    const row = await this.em.findOne(
      OtpTokenOrmEntity,
      {
        tenantId: params.tenantId,
        purpose: params.purpose,
        tokenHash: params.tokenHash,
      } as any,
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );

    if (!row) return undefined;
    if (row.consumedAt) return undefined;
    if (row.expiresAt && row.expiresAt.getTime() <= now.getTime())
      return undefined;

    return {
      id: String((row as any).id ?? row.requestId), // 엔티티 PK가 뭐든 대응(필요 시 id 필드로 맞춰줘)
      tenantId: row.tenantId,
      userId: row.userId,
      purpose: row.purpose as OtpPurpose,
      requestId: row.requestId,
      expiresAt: row.expiresAt,
      consumedAt: row.consumedAt ?? null,
    };
  }

  async consume(params: {
    tenantId: string;
    purpose: OtpPurpose;
    otpTokenId: string;
    consumedAt?: Date;
  }): Promise<void> {
    const consumedAt = params.consumedAt ?? new Date();

    // PK 기반으로 가져오되, tenant/purpose도 함께 걸어서 안전하게
    const row = await this.em.findOne(
      OtpTokenOrmEntity,
      {
        tenantId: params.tenantId,
        purpose: params.purpose,
        // id 컬럼명이 다르면 여기만 맞춰줘 (예: id, requestId 등)
        id: params.otpTokenId as any,
      } as any,
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );

    if (!row) return; // 멱등
    if (row.consumedAt) return; // 멱등

    row.consumedAt = consumedAt;
    await this.em.flush();
  }
}
