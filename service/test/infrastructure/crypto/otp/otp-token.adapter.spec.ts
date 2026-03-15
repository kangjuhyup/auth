import { OtpTokenAdapter } from '@infrastructure/crypto/otp/otp-token.adapter';
import { OtpTokenOrmEntity } from '@infrastructure/mikro-orm/entities/otp-token';
import type { EntityManager } from '@mikro-orm/core';

describe('OtpTokenAdapter', () => {
  let em: jest.Mocked<EntityManager>;
  let adapter: OtpTokenAdapter;

  beforeEach(() => {
    em = {
      findOne: jest.fn(),
      flush: jest.fn(),
    } as any;

    adapter = new OtpTokenAdapter(em);
  });

  describe('findValidByTokenHash', () => {
    it('정상 토큰이면 record를 반환한다', async () => {
      const entity = {
        id: 'id-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        purpose: 'PASSWORD_RESET',
        requestId: 'req-1',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 60_000),
        consumedAt: null,
        createdAt: new Date(),
        issuedAt: new Date(),
      } as unknown as OtpTokenOrmEntity;

      em.findOne.mockResolvedValue(entity);

      const result = await adapter.findValidByTokenHash({
        tenantId: 'tenant-1',
        tokenHash: 'hash',
        purpose: 'PASSWORD_RESET',
      });

      expect(em.findOne).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        id: entity.id,
        tenantId: entity.tenantId,
        userId: entity.userId,
        purpose: entity.purpose,
        requestId: entity.requestId,
        expiresAt: entity.expiresAt,
        consumedAt: entity.consumedAt,
      });
    });

    it('만료된 토큰이면 undefined를 반환한다', async () => {
      const entity = {
        id: 'id-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        purpose: 'PASSWORD_RESET',
        requestId: 'req-1',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() - 60_000), // 이미 만료
        consumedAt: null,
        issuedAt: new Date(),
        createdAt: new Date(),
      } as unknown as OtpTokenOrmEntity;

      em.findOne.mockResolvedValue(entity);

      const result = await adapter.findValidByTokenHash({
        tenantId: 'tenant-1',
        tokenHash: 'hash',
        purpose: 'PASSWORD_RESET',
      });

      expect(result).toBeUndefined();
    });

    it('이미 consumed 된 토큰이면 undefined를 반환한다', async () => {
      const entity = {
        id: 'id-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        purpose: 'PASSWORD_RESET',
        requestId: 'req-1',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 60_000),
        consumedAt: new Date(),
        issuedAt: new Date(),
        createdAt: new Date(),
      } as unknown as OtpTokenOrmEntity;

      em.findOne.mockResolvedValue(entity);

      const result = await adapter.findValidByTokenHash({
        tenantId: 'tenant-1',
        tokenHash: 'hash',
        purpose: 'PASSWORD_RESET',
      });

      expect(result).toBeUndefined();
    });

    it('DB에 존재하지 않으면 undefined를 반환한다', async () => {
      em.findOne.mockResolvedValue(null);

      const result = await adapter.findValidByTokenHash({
        tenantId: 'tenant-1',
        tokenHash: 'hash',
        purpose: 'PASSWORD_RESET',
      });

      expect(result).toBeUndefined();
    });
  });

  describe('consume', () => {
    it('consumedAt을 설정하고 flush를 호출한다', async () => {
      const entity = {
        id: 'id-1',
        consumedAt: null,
      } as unknown as OtpTokenOrmEntity;

      em.findOne.mockResolvedValue(entity);

      await adapter.consume({
        tenantId: 'tenant-1',
        purpose: 'PASSWORD_RESET',
        otpTokenId: 'id-1',
      });

      expect(entity.consumedAt).toBeInstanceOf(Date);
      expect(em.flush).toHaveBeenCalledTimes(1);
    });

    it('존재하지 않는 경우 flush를 호출하지 않는다', async () => {
      em.findOne.mockResolvedValue(null);

      await adapter.consume({
        tenantId: 'tenant-1',
        purpose: 'PASSWORD_RESET',
        otpTokenId: 'not-exist',
      });

      expect(em.flush).not.toHaveBeenCalled();
    });
  });
});
