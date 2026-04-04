import { NotFoundException } from '@nestjs/common';
import { KeyCommandHandler } from '@application/commands/handlers/key-command.handler';
import { TenantModel } from '@domain/models/tenant';
import { JwksKeyModel } from '@domain/models/jwks-key';
import type { TenantRepository, JwksKeyRepository } from '@domain/repositories';
import type { JwksKeyCryptoPort } from '@application/ports/jwks-key-crypto.port';

function makeTenant(id = 'tenant-1'): TenantModel {
  const t = new TenantModel({ code: 'acme', name: 'ACME Corp' });
  t.setPersistence(id, new Date(), new Date());
  return t;
}

function makeActiveKey(kid: string, tenantId = 'tenant-1'): JwksKeyModel {
  return new JwksKeyModel({
    kid,
    tenantId,
    algorithm: 'RS256',
    publicKey: 'pub-pem',
    privateKeyEnc: 'enc-priv',
    status: 'active',
    rotatedAt: null,
    expiresAt: null,
    createdAt: new Date(),
  });
}

function createMockTenantRepo(): jest.Mocked<TenantRepository> {
  return {
    findById: jest.fn().mockResolvedValue(makeTenant()),
    findByCode: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn().mockResolvedValue(makeTenant()),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockJwksKeyRepo(): jest.Mocked<JwksKeyRepository> {
  return {
    findActiveByTenantId: jest.fn().mockResolvedValue([]),
    saveMany: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<JwksKeyRepository>;
}

function createMockJwksKeyCrypto(): jest.Mocked<JwksKeyCryptoPort> {
  return {
    generateKeyPair: jest.fn().mockResolvedValue({
      kid: 'new-kid',
      algorithm: 'RS256',
      publicKeyPem: 'new-pub',
      privateKeyEncrypted: 'new-enc-priv',
    }),
  };
}

describe('KeyCommandHandler', () => {
  let handler: KeyCommandHandler;
  let tenantRepo: jest.Mocked<TenantRepository>;
  let jwksKeyRepo: jest.Mocked<JwksKeyRepository>;
  let jwksKeyCrypto: jest.Mocked<JwksKeyCryptoPort>;

  beforeEach(() => {
    jest.clearAllMocks();
    tenantRepo = createMockTenantRepo();
    jwksKeyRepo = createMockJwksKeyRepo();
    jwksKeyCrypto = createMockJwksKeyCrypto();
    handler = new KeyCommandHandler(tenantRepo, jwksKeyRepo, jwksKeyCrypto);
  });

  describe('rotateKeys', () => {
    it('tenant가 없으면 NotFoundException을 던진다', async () => {
      tenantRepo.findById.mockResolvedValue(null as any);

      await expect(handler.rotateKeys('tenant-1')).rejects.toThrow(NotFoundException);
    });

    it('active 키 없음 → 신규 키만 saveMany', async () => {
      jwksKeyRepo.findActiveByTenantId.mockResolvedValue([]);

      await handler.rotateKeys('tenant-1');

      const saved = jwksKeyRepo.saveMany.mock.calls[0][0] as JwksKeyModel[];
      expect(saved).toHaveLength(1);
      expect(saved[0].kid).toBe('new-kid');
      expect(saved[0].status).toBe('active');
    });

    it('active 키 있음 → markRotated + 신규 키 포함 saveMany', async () => {
      const oldKey1 = makeActiveKey('old-kid-1');
      const oldKey2 = makeActiveKey('old-kid-2');
      jwksKeyRepo.findActiveByTenantId.mockResolvedValue([oldKey1, oldKey2]);

      await handler.rotateKeys('tenant-1');

      expect(oldKey1.status).toBe('rotated');
      expect(oldKey2.status).toBe('rotated');

      const saved = jwksKeyRepo.saveMany.mock.calls[0][0] as JwksKeyModel[];
      expect(saved).toHaveLength(3);
      expect(saved.find((k) => k.kid === 'new-kid')?.status).toBe('active');
    });

    it('신규 키 생성에 RS256 알고리즘을 요청한다', async () => {
      await handler.rotateKeys('tenant-1');

      expect(jwksKeyCrypto.generateKeyPair).toHaveBeenCalledWith('RS256');
    });
  });
});
