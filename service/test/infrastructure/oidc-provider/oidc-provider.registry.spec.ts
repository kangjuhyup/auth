import type Provider from 'oidc-provider';
import { OidcProviderRegistry } from '@infrastructure/oidc-provider/oidc-provider.registry';

describe('OidcProviderRegistry', () => {
  const makeProvider = () => ({}) as Provider;

  function versionedRegistry(params?: {
    revision?: string;
    now?: () => number;
    create?: jest.Mock<Promise<Provider>, [string]>;
  }) {
    let revision = params?.revision ?? 'scope:openid';
    const create =
      params?.create ??
      jest.fn().mockImplementation(async () => makeProvider());
    const resolveRevision = jest.fn().mockImplementation(async () => revision);
    const registry = new OidcProviderRegistry(create, undefined, {
      resolveRevision,
      revisionPollIntervalMs: 0,
      now: params?.now,
    });

    return {
      registry,
      create,
      resolveRevision,
      setRevision(next: string) {
        revision = next;
      },
    };
  }

  it('처음 요청 시 create 함수를 호출하여 Provider를 생성한다', async () => {
    const create = jest.fn().mockResolvedValue(makeProvider());
    const registry = new OidcProviderRegistry(create);

    const provider = await registry.get('tenant-a');

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith('tenant-a');
    expect(provider).toBeDefined();
  });

  it('같은 tenantCode에 대해 두 번째 호출 시 create를 다시 호출하지 않는다 (캐시 사용)', async () => {
    const providerInstance = makeProvider();
    const create = jest.fn().mockResolvedValue(providerInstance);
    const registry = new OidcProviderRegistry(create);

    const first = await registry.get('tenant-a');
    const second = await registry.get('tenant-a');

    expect(create).toHaveBeenCalledTimes(1);
    expect(first).toBe(providerInstance);
    expect(second).toBe(providerInstance);
    expect(first).toBe(second);
  });

  it('다른 tenantCode에 대해서는 각각 별도의 Provider를 생성한다', async () => {
    const create = jest
      .fn()
      .mockResolvedValueOnce(makeProvider())
      .mockResolvedValueOnce(makeProvider());

    const registry = new OidcProviderRegistry(create);

    const providerA = await registry.get('tenant-a');
    const providerB = await registry.get('tenant-b');

    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenNthCalledWith(1, 'tenant-a');
    expect(create).toHaveBeenNthCalledWith(2, 'tenant-b');
    expect(providerA).not.toBe(providerB);
  });

  it('이미 생성된 tenantCode는 Map에서 그대로 반환한다', async () => {
    const providerInstance = makeProvider();
    const create = jest.fn().mockResolvedValue(providerInstance);
    const registry = new OidcProviderRegistry(create);

    await registry.get('tenant-a');

    // 내부 Map에 직접 접근할 수는 없지만,
    // 동일 인스턴스 반환 여부로 캐시 동작을 검증
    const again = await registry.get('tenant-a');

    expect(again).toBe(providerInstance);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('provider 생성과 cache hit/miss metric을 기록한다', async () => {
    const providerInstance = makeProvider();
    const create = jest.fn().mockResolvedValue(providerInstance);
    const metrics = {
      incrementCounter: jest.fn(),
      observeLatency: jest.fn(),
      snapshot: jest.fn(),
    };
    const registry = new OidcProviderRegistry(create, metrics as any);

    await registry.get('tenant-a');
    await registry.get('tenant-a');

    expect(metrics.incrementCounter).toHaveBeenCalledWith(
      'provider_cache_miss_total',
      { tenantCode: 'tenant-a' },
    );
    expect(metrics.incrementCounter).toHaveBeenCalledWith(
      'provider_created_total',
      { tenantCode: 'tenant-a' },
    );
    expect(metrics.incrementCounter).toHaveBeenCalledWith(
      'provider_cache_hit_total',
      { tenantCode: 'tenant-a' },
    );
  });

  it('warm-up 이후 scope 추가·비활성화·삭제 revision마다 Provider를 교체한다', async () => {
    const { registry, create, setRevision } = versionedRegistry();

    const initial = await registry.get('tenant-a');
    setRevision('scope:openid orders:read');
    const added = await registry.get('tenant-a');
    setRevision('scope:openid');
    const disabled = await registry.get('tenant-a');
    setRevision('scope:openid orders:read');
    await registry.get('tenant-a');
    setRevision('scope:openid');
    const deleted = await registry.get('tenant-a');

    expect(create).toHaveBeenCalledTimes(5);
    expect(initial).not.toBe(added);
    expect(added).not.toBe(disabled);
    expect(disabled).not.toBe(deleted);
  });

  it('공유 revision을 읽는 여러 registry 인스턴스가 각 Pod cache를 갱신한다', async () => {
    let revision = 'scope:openid';
    const resolveRevision = jest.fn().mockImplementation(async () => revision);
    const createA = jest.fn().mockImplementation(async () => makeProvider());
    const createB = jest.fn().mockImplementation(async () => makeProvider());
    const options = { resolveRevision, revisionPollIntervalMs: 0 };
    const podA = new OidcProviderRegistry(createA, undefined, options);
    const podB = new OidcProviderRegistry(createB, undefined, options);

    const [initialA, initialB] = await Promise.all([
      podA.get('tenant-a'),
      podB.get('tenant-a'),
    ]);
    revision = 'scope:openid offline_access';
    const [updatedA, updatedB] = await Promise.all([
      podA.get('tenant-a'),
      podB.get('tenant-a'),
    ]);

    expect(updatedA).not.toBe(initialA);
    expect(updatedB).not.toBe(initialB);
    expect(createA).toHaveBeenCalledTimes(2);
    expect(createB).toHaveBeenCalledTimes(2);
  });

  it('같은 tenant의 동시 갱신 요청은 하나의 Provider 생성만 공유한다', async () => {
    const { registry, create, setRevision } = versionedRegistry();
    await registry.get('tenant-a');
    setRevision('scope:openid offline_access');

    const [first, second, third] = await Promise.all([
      registry.get('tenant-a'),
      registry.get('tenant-a'),
      registry.get('tenant-a'),
    ]);

    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('생성 중 revision이 바뀌면 늦게 완료된 candidate를 삽입하지 않는다', async () => {
    let revision = 'scope:openid';
    let releaseCandidate!: (provider: Provider) => void;
    const delayedCandidate = new Promise<Provider>((resolve) => {
      releaseCandidate = resolve;
    });
    const initial = makeProvider();
    const stale = makeProvider();
    const stable = makeProvider();
    const create = jest
      .fn<Promise<Provider>, [string]>()
      .mockResolvedValueOnce(initial)
      .mockReturnValueOnce(delayedCandidate)
      .mockResolvedValueOnce(stable);
    const resolveRevision = jest.fn().mockImplementation(async () => revision);
    const registry = new OidcProviderRegistry(create, undefined, {
      resolveRevision,
      revisionPollIntervalMs: 0,
    });

    await registry.get('tenant-a');
    revision = 'scope:openid orders:read';
    const refresh = registry.get('tenant-a');
    await Promise.resolve();
    revision = 'scope:openid orders:write';
    releaseCandidate(stale);

    await expect(refresh).resolves.toBe(stable);
    await expect(registry.get('tenant-a')).resolves.toBe(stable);
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('변경 감지 후 생성 실패는 stale Provider를 반환하지 않고 다음 요청에서 재시도한다', async () => {
    const initial = makeProvider();
    const recovered = makeProvider();
    const create = jest
      .fn<Promise<Provider>, [string]>()
      .mockResolvedValueOnce(initial)
      .mockRejectedValueOnce(new Error('provider refresh failed'))
      .mockResolvedValueOnce(recovered);
    const { registry, setRevision } = versionedRegistry({ create });

    await registry.get('tenant-a');
    setRevision('scope:openid offline_access');

    await expect(registry.get('tenant-a')).rejects.toThrow(
      'provider refresh failed',
    );
    await expect(registry.get('tenant-a')).resolves.toBe(recovered);
  });

  it('revision 조회 실패 시 stale Provider를 제공하지 않고 복구 후 재시도한다', async () => {
    const initial = makeProvider();
    const create = jest.fn().mockResolvedValue(initial);
    let revisionLookupFails = false;
    const resolveRevision = jest.fn().mockImplementation(async () => {
      if (revisionLookupFails) throw new Error('database details');
      return 'scope:openid';
    });
    const registry = new OidcProviderRegistry(create, undefined, {
      resolveRevision,
      revisionPollIntervalMs: 0,
    });

    await expect(registry.get('tenant-a')).resolves.toBe(initial);
    revisionLookupFails = true;
    await expect(registry.get('tenant-a')).rejects.toThrow(
      'OIDC provider configuration revision check failed',
    );
    revisionLookupFails = false;
    await expect(registry.get('tenant-a')).resolves.toBe(initial);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('revision 변경은 해당 tenant에만 적용한다', async () => {
    const revisions = new Map([
      ['tenant-a', 'scope:openid'],
      ['tenant-b', 'scope:openid'],
    ]);
    const create = jest.fn().mockImplementation(async () => makeProvider());
    const registry = new OidcProviderRegistry(create, undefined, {
      resolveRevision: async (tenantCode) => revisions.get(tenantCode)!,
      revisionPollIntervalMs: 0,
    });

    const initialA = await registry.get('tenant-a');
    const initialB = await registry.get('tenant-b');
    revisions.set('tenant-a', 'scope:openid offline_access');

    expect(await registry.get('tenant-a')).not.toBe(initialA);
    expect(await registry.get('tenant-b')).toBe(initialB);
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('poll interval 안에서는 기존 Provider를 사용하고 만료 직후 authoritative revision을 확인한다', async () => {
    let now = 1_000;
    let revision = 'scope:openid';
    const create = jest.fn().mockImplementation(async () => makeProvider());
    const resolveRevision = jest.fn().mockImplementation(async () => revision);
    const registry = new OidcProviderRegistry(create, undefined, {
      resolveRevision,
      revisionPollIntervalMs: 1_000,
      now: () => now,
    });

    const initial = await registry.get('tenant-a');
    revision = 'scope:openid offline_access';
    now = 1_999;
    expect(await registry.get('tenant-a')).toBe(initial);
    now = 2_000;
    expect(await registry.get('tenant-a')).not.toBe(initial);
  });
});
