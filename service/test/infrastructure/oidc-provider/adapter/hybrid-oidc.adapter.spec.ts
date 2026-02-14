import { HybridAdapter } from '@infrastructure/oidc-provider/adapters/hybrid-oidc.adapter';

describe('HybridAdapter', () => {
  const makeRdb = () => ({
    upsert: jest.fn().mockResolvedValue(undefined),
    find: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    revokeByGrantId: jest.fn().mockResolvedValue(undefined),
    findByUid: jest.fn().mockResolvedValue(undefined),
    findByUserCode: jest.fn().mockResolvedValue(undefined),
  });

  const makeCache = () => ({
    upsert: jest.fn().mockResolvedValue(undefined),
    find: jest.fn().mockResolvedValue(undefined),
    findByUid: jest.fn().mockResolvedValue(undefined),
    findByUserCode: jest.fn().mockResolvedValue(undefined),

    consume: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    revokeByGrantId: jest.fn().mockResolvedValue(undefined),

    isNegativeCachedById: jest.fn().mockResolvedValue(false),
    negativeCacheById: jest.fn().mockResolvedValue(undefined),
    cacheById: jest.fn().mockResolvedValue(undefined),

    resolveIdByUid: jest.fn().mockResolvedValue(undefined),
    negativeCacheUid: jest.fn().mockResolvedValue(undefined),

    resolveIdByUserCode: jest.fn().mockResolvedValue(undefined),
    negativeCacheUserCode: jest.fn().mockResolvedValue(undefined),
  });

  const makeAdapter = (over?: {
    rdb?: any;
    cache?: any;
    cacheTtlMarginSec?: number;
    negativeTtlSec?: number;
    backfillTtlSec?: number;
  }) => {
    const rdb = over?.rdb ?? makeRdb();
    const cache = over?.cache ?? makeCache();

    const adapter = new HybridAdapter({
      kind: 'AccessToken',
      rdb,
      cache,
      cacheTtlMarginSec: over?.cacheTtlMarginSec ?? 5,
      negativeTtlSec: over?.negativeTtlSec ?? 3,
      backfillTtlSec: over?.backfillTtlSec ?? 60,
    } as any);

    return { adapter, rdb, cache };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================
  // Write-through
  // =========================

  it('upsert: rdb.upsert를 호출하고 cache.upsert도 best-effort로 호출한다(순서 포함)', async () => {
    const { adapter, rdb, cache } = makeAdapter();

    await adapter.upsert('id-1', { foo: 'bar' } as any, 100);

    expect(rdb.upsert).toHaveBeenCalledTimes(1);
    expect(cache.upsert).toHaveBeenCalledTimes(1);

    // 호출 순서만 검증(인자 검증 X)
    expect(rdb.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      cache.upsert.mock.invocationCallOrder[0],
    );
  });

  it('upsert: cache.upsert가 실패해도 throw하지 않는다(best-effort)', async () => {
    const rdb = makeRdb();
    const cache = makeCache();
    cache.upsert.mockRejectedValue(new Error('redis down'));

    const { adapter } = makeAdapter({ rdb, cache });

    await expect(
      adapter.upsert('id-1', { foo: 'bar' } as any, 100),
    ).resolves.toBeUndefined();

    expect(rdb.upsert).toHaveBeenCalledTimes(1);
    expect(cache.upsert).toHaveBeenCalledTimes(1);
  });

  it('consume: rdb.consume 후 cache.consume 호출(best-effort)', async () => {
    const { adapter, rdb, cache } = makeAdapter();

    await adapter.consume('id-1');

    expect(rdb.consume).toHaveBeenCalledTimes(1);
    expect(cache.consume).toHaveBeenCalledTimes(1);
    expect(rdb.consume.mock.invocationCallOrder[0]).toBeLessThan(
      cache.consume.mock.invocationCallOrder[0],
    );
  });

  it('destroy: rdb.destroy 후 cache.destroy 호출(best-effort)', async () => {
    const { adapter, rdb, cache } = makeAdapter();

    await adapter.destroy('id-1');

    expect(rdb.destroy).toHaveBeenCalledTimes(1);
    expect(cache.destroy).toHaveBeenCalledTimes(1);
    expect(rdb.destroy.mock.invocationCallOrder[0]).toBeLessThan(
      cache.destroy.mock.invocationCallOrder[0],
    );
  });

  it('revokeByGrantId: rdb.revokeByGrantId 후 cache.revokeByGrantId 호출(best-effort)', async () => {
    const { adapter, rdb, cache } = makeAdapter();

    await adapter.revokeByGrantId('grant-1');

    expect(rdb.revokeByGrantId).toHaveBeenCalledTimes(1);
    expect(cache.revokeByGrantId).toHaveBeenCalledTimes(1);
    expect(rdb.revokeByGrantId.mock.invocationCallOrder[0]).toBeLessThan(
      cache.revokeByGrantId.mock.invocationCallOrder[0],
    );
  });

  // =========================
  // Read: find(id)
  // =========================

  it('find: id가 negative cached이면 cache.find/rdb.find를 호출하지 않고 undefined 반환', async () => {
    const cache = makeCache();
    cache.isNegativeCachedById.mockResolvedValue(true);

    const { adapter, rdb } = makeAdapter({ cache });

    const res = await adapter.find('id-1');

    expect(res).toBeUndefined();
    expect(cache.isNegativeCachedById).toHaveBeenCalledTimes(1);
    expect(cache.find).not.toHaveBeenCalled();
    expect(rdb.find).not.toHaveBeenCalled();
  });

  it('find: cache hit이면 rdb.find를 호출하지 않고 payload 반환', async () => {
    const cache = makeCache();
    cache.find.mockResolvedValue({ a: 1 } as any);

    const { adapter, rdb } = makeAdapter({ cache });

    const res = await adapter.find('id-1');

    expect(res).toEqual({ a: 1 });
    expect(cache.find).toHaveBeenCalledTimes(1);
    expect(rdb.find).not.toHaveBeenCalled();
  });

  it('find: cache miss + rdb miss이면 negativeCacheById를 호출하고 undefined 반환', async () => {
    const { adapter, rdb, cache } = makeAdapter();
    rdb.find.mockResolvedValue(undefined);

    const res = await adapter.find('id-1');

    expect(res).toBeUndefined();
    expect(cache.find).toHaveBeenCalledTimes(1);
    expect(rdb.find).toHaveBeenCalledTimes(1);
    expect(cache.negativeCacheById).toHaveBeenCalledTimes(1);
  });

  it('find: cache miss + rdb hit이면 cacheById를 호출하고 payload 반환', async () => {
    const { adapter, rdb, cache } = makeAdapter();
    rdb.find.mockResolvedValue({ ok: true } as any);

    const res = await adapter.find('id-1');

    expect(res).toEqual({ ok: true });
    expect(cache.find).toHaveBeenCalledTimes(1);
    expect(rdb.find).toHaveBeenCalledTimes(1);
    expect(cache.cacheById).toHaveBeenCalledTimes(1);
  });

  // =========================
  // Read: findByUid(uid)
  // =========================

  it('findByUid: resolveIdByUid hit이면 find(id) 경로로 간다(= cache.find 또는 rdb.find 호출)', async () => {
    const cache = makeCache();
    cache.resolveIdByUid.mockResolvedValue('id-1');
    cache.find.mockResolvedValue({ from: 'cache' } as any);

    const { adapter, rdb } = makeAdapter({ cache });

    const res = await adapter.findByUid('uid-1');

    expect(res).toEqual({ from: 'cache' });
    expect(cache.resolveIdByUid).toHaveBeenCalledTimes(1);
    expect(rdb.find).not.toHaveBeenCalled(); // find(id)에서 cache hit로 끝났기 때문
  });

  it('findByUid: resolveIdByUid miss + cache.findByUid hit이면 payload 반환', async () => {
    const cache = makeCache();
    cache.resolveIdByUid.mockResolvedValue(undefined);
    cache.findByUid.mockResolvedValue({ p: 1 } as any);

    const { adapter, rdb } = makeAdapter({ cache });

    const res = await adapter.findByUid('uid-1');

    expect(res).toEqual({ p: 1 });
    expect(cache.findByUid).toHaveBeenCalledTimes(1);
    expect(rdb.findByUid).not.toHaveBeenCalled();
  });

  it('findByUid: cache miss + rdb miss이면 negativeCacheUid를 호출하고 undefined 반환', async () => {
    const { adapter, rdb, cache } = makeAdapter();
    rdb.findByUid.mockResolvedValue(undefined);

    const res = await adapter.findByUid('uid-1');

    expect(res).toBeUndefined();
    expect(rdb.findByUid).toHaveBeenCalledTimes(1);
    expect(cache.negativeCacheUid).toHaveBeenCalledTimes(1);
  });

  it('findByUid: cache miss + rdb hit이면 payload 반환(추가 캐시 채움은 하지 않음)', async () => {
    const { adapter, rdb, cache } = makeAdapter();
    rdb.findByUid.mockResolvedValue({ ok: true } as any);

    const res = await adapter.findByUid('uid-1');

    expect(res).toEqual({ ok: true });
    expect(rdb.findByUid).toHaveBeenCalledTimes(1);
    expect(cache.negativeCacheUid).not.toHaveBeenCalled();
  });

  // =========================
  // Read: findByUserCode(userCode)
  // =========================

  it('findByUserCode: resolveIdByUserCode hit이면 find(id) 경로로 간다', async () => {
    const cache = makeCache();
    cache.resolveIdByUserCode.mockResolvedValue('id-1');
    cache.find.mockResolvedValue({ from: 'cache' } as any);

    const { adapter, rdb } = makeAdapter({ cache });

    const res = await adapter.findByUserCode('code-1');

    expect(res).toEqual({ from: 'cache' });
    expect(cache.resolveIdByUserCode).toHaveBeenCalledTimes(1);
    expect(rdb.find).not.toHaveBeenCalled();
  });

  it('findByUserCode: resolveIdByUserCode miss + cache.findByUserCode hit이면 payload 반환', async () => {
    const cache = makeCache();
    cache.resolveIdByUserCode.mockResolvedValue(undefined);
    cache.findByUserCode.mockResolvedValue({ p: 1 } as any);

    const { adapter, rdb } = makeAdapter({ cache });

    const res = await adapter.findByUserCode('code-1');

    expect(res).toEqual({ p: 1 });
    expect(cache.findByUserCode).toHaveBeenCalledTimes(1);
    expect(rdb.findByUserCode).not.toHaveBeenCalled();
  });

  it('findByUserCode: cache miss + rdb miss이면 negativeCacheUserCode를 호출하고 undefined 반환', async () => {
    const { adapter, rdb, cache } = makeAdapter();
    rdb.findByUserCode.mockResolvedValue(undefined);

    const res = await adapter.findByUserCode('code-1');

    expect(res).toBeUndefined();
    expect(rdb.findByUserCode).toHaveBeenCalledTimes(1);
    expect(cache.negativeCacheUserCode).toHaveBeenCalledTimes(1);
  });

  it('findByUserCode: cache miss + rdb hit이면 payload 반환', async () => {
    const { adapter, rdb, cache } = makeAdapter();
    rdb.findByUserCode.mockResolvedValue({ ok: true } as any);

    const res = await adapter.findByUserCode('code-1');

    expect(res).toEqual({ ok: true });
    expect(rdb.findByUserCode).toHaveBeenCalledTimes(1);
    expect(cache.negativeCacheUserCode).not.toHaveBeenCalled();
  });

  it('find: cache.isNegativeCachedById가 throw해도 rdb로 진행한다', async () => {
    const rdb = makeRdb();
    rdb.find.mockResolvedValue({ ok: true });

    const cache = makeCache();
    cache.isNegativeCachedById.mockRejectedValue(new Error('redis down'));
    cache.find.mockResolvedValue(undefined);

    const { adapter } = makeAdapter({ rdb, cache });

    const res = await adapter.find('id-1');

    expect(res).toEqual({ ok: true });
    expect(rdb.find).toHaveBeenCalledTimes(1);
  });

  it('find: cache.find가 throw해도 rdb로 폴백한다', async () => {
    const rdb = makeRdb();
    rdb.find.mockResolvedValue({ ok: true });

    const cache = makeCache();
    cache.find.mockRejectedValue(new Error('redis down'));

    const { adapter } = makeAdapter({ rdb, cache });

    const res = await adapter.find('id-1');

    expect(res).toEqual({ ok: true });
    expect(rdb.find).toHaveBeenCalledTimes(1);
  });

  it('find: cache.find가 throw + rdb miss이면 negativeCacheById 시도(실패해도 ok)', async () => {
    const rdb = makeRdb();
    rdb.find.mockResolvedValue(undefined);

    const cache = makeCache();
    cache.find.mockRejectedValue(new Error('redis down'));
    cache.negativeCacheById.mockRejectedValue(new Error('redis down'));

    const { adapter } = makeAdapter({ rdb, cache });

    const res = await adapter.find('id-1');

    expect(res).toBeUndefined();
    expect(rdb.find).toHaveBeenCalledTimes(1);
    // negativeCacheById는 bestEffort라 실패해도 테스트는 통과해야 함
    expect(cache.negativeCacheById).toHaveBeenCalledTimes(1);
  });

  it('upsert: cache.upsert가 throw해도 전체 성공(rdb upsert는 수행)', async () => {
    const rdb = makeRdb();
    const cache = makeCache();
    cache.upsert.mockRejectedValue(new Error('redis down'));

    const { adapter } = makeAdapter({ rdb, cache });

    await expect(
      adapter.upsert('id-1', { a: 1 } as any, 100),
    ).resolves.toBeUndefined();

    expect(rdb.upsert).toHaveBeenCalledTimes(1);
    expect(cache.upsert).toHaveBeenCalledTimes(1);
  });

  it('consume: cache.consume이 throw해도 전체 성공(rdb consume은 수행)', async () => {
    const rdb = makeRdb();
    const cache = makeCache();
    cache.consume.mockRejectedValue(new Error('redis down'));

    const { adapter } = makeAdapter({ rdb, cache });

    await expect(adapter.consume('id-1')).resolves.toBeUndefined();

    expect(rdb.consume).toHaveBeenCalledTimes(1);
    expect(cache.consume).toHaveBeenCalledTimes(1);
  });

  it('destroy: cache.destroy가 throw해도 전체 성공(rdb destroy는 수행)', async () => {
    const rdb = makeRdb();
    const cache = makeCache();
    cache.destroy.mockRejectedValue(new Error('redis down'));

    const { adapter } = makeAdapter({ rdb, cache });

    await expect(adapter.destroy('id-1')).resolves.toBeUndefined();

    expect(rdb.destroy).toHaveBeenCalledTimes(1);
    expect(cache.destroy).toHaveBeenCalledTimes(1);
  });

  it('revokeByGrantId: cache.revokeByGrantId가 throw해도 전체 성공(rdb revoke는 수행)', async () => {
    const rdb = makeRdb();
    const cache = makeCache();
    cache.revokeByGrantId.mockRejectedValue(new Error('redis down'));

    const { adapter } = makeAdapter({ rdb, cache });

    await expect(adapter.revokeByGrantId('grant-1')).resolves.toBeUndefined();

    expect(rdb.revokeByGrantId).toHaveBeenCalledTimes(1);
    expect(cache.revokeByGrantId).toHaveBeenCalledTimes(1);
  });
});
