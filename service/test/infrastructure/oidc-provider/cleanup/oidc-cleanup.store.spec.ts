import { EntityManager, LockMode } from '@mikro-orm/core';
import { OidcModelOrmEntity } from '@infrastructure/mikro-orm/entities/oidc-model';
import { OidcSessionIndexOrmEntity } from '@infrastructure/mikro-orm/entities/oidc-session-index';
import { OidcCleanupStore } from '@infrastructure/oidc-provider/cleanup/oidc-cleanup.store';

describe('OidcCleanupStore', () => {
  const cutoff = new Date('2026-01-01T00:00:00Z');
  const tx = {
    getPlatform: () => ({
      getConfig: () => ({ get: () => ({ name: 'MockDriver' }) }),
    }),
    find: jest.fn(),
    nativeDelete: jest.fn(),
  };
  const em = { fork: jest.fn(), transactional: jest.fn() };
  let store: OidcCleanupStore;
  beforeEach(() => {
    jest.resetAllMocks();
    em.fork.mockReturnValue(em);
    em.transactional.mockImplementation((fn) => fn(tx));
    tx.find.mockResolvedValue([]);
    store = new OidcCleanupStore(em as unknown as EntityManager);
  });

  it('selects only expired allowlisted models under a bounded transaction lock', async () => {
    await expect(store.cleanupBatch(cutoff, 500)).resolves.toEqual({
      deletedModels: 0,
      deletedSessionIndexes: 0,
    });
    expect(tx.find).toHaveBeenCalledWith(
      OidcModelOrmEntity,
      {
        kind: {
          $in: [
            'AccessToken',
            'AuthorizationCode',
            'Interaction',
            'Session',
            'Grant',
            'RefreshToken',
          ],
        },
        expiresAt: { $lt: cutoff },
      },
      expect.objectContaining({
        limit: 500,
        lockMode: LockMode.PESSIMISTIC_WRITE,
        fields: ['tenantId', 'kind', 'id'],
      }),
    );
    expect(tx.nativeDelete).not.toHaveBeenCalled();
  });

  it('rechecks expiry and removes session indexes only for the deleted tenant/session', async () => {
    tx.find.mockResolvedValue([
      { tenantId: 'a', kind: 'Session', id: 's' },
      { tenantId: 'b', kind: 'AccessToken', id: 's' },
    ]);
    tx.nativeDelete
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(0);
    await expect(store.cleanupBatch(cutoff, 500)).resolves.toEqual({
      deletedModels: 1,
      deletedSessionIndexes: 3,
    });
    expect(tx.nativeDelete).toHaveBeenNthCalledWith(1, OidcModelOrmEntity, {
      tenantId: 'a',
      kind: 'Session',
      id: { $in: ['s'] },
      expiresAt: { $lt: cutoff },
    });
    expect(tx.nativeDelete).toHaveBeenNthCalledWith(
      2,
      OidcSessionIndexOrmEntity,
      { tenantId: 'a', sessionId: { $in: ['s'] } },
    );
    expect(tx.nativeDelete).toHaveBeenCalledTimes(3);
  });

  it('groups parent deletes by tenant and kind', async () => {
    tx.find.mockResolvedValue([
      { tenantId: 'a', kind: 'AccessToken', id: '1' },
      { tenantId: 'a', kind: 'AccessToken', id: '2' },
    ]);
    tx.nativeDelete.mockResolvedValueOnce(2);
    await expect(store.cleanupBatch(cutoff, 500)).resolves.toEqual({
      deletedModels: 2,
      deletedSessionIndexes: 0,
    });
    expect(tx.nativeDelete).toHaveBeenCalledTimes(1);
    expect(tx.nativeDelete).toHaveBeenCalledWith(OidcModelOrmEntity, {
      tenantId: 'a',
      kind: 'AccessToken',
      id: { $in: ['1', '2'] },
      expiresAt: { $lt: cutoff },
    });
  });
  it('rolls back a Session group when not all parents were deleted', async () => {
    tx.find.mockResolvedValue([{ tenantId: 'a', kind: 'Session', id: 's' }]);
    tx.nativeDelete.mockResolvedValueOnce(0);
    await expect(store.cleanupBatch(cutoff, 500)).rejects.toThrow(
      'eligibility changed',
    );
    expect(tx.nativeDelete).toHaveBeenCalledTimes(1);
  });
  it.each([0, -1, 1001, 1.5, NaN, Infinity])(
    'rejects invalid batch size %s before database work',
    async (size) => {
      await expect(store.cleanupBatch(cutoff, size)).rejects.toThrow(
        RangeError,
      );
      expect(em.fork).not.toHaveBeenCalled();
    },
  );
  it('rejects invalid cutoff before database work', async () => {
    await expect(store.cleanupBatch(new Date(NaN), 500)).rejects.toThrow(
      RangeError,
    );
    expect(em.fork).not.toHaveBeenCalled();
  });
  it('propagates index deletion failure so the enclosing transaction rolls back', async () => {
    tx.find.mockResolvedValue([{ tenantId: 'a', kind: 'Session', id: 's' }]);
    tx.nativeDelete
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error('delete failed'));
    await expect(store.cleanupBatch(cutoff, 500)).rejects.toThrow(
      'delete failed',
    );
  });
});
