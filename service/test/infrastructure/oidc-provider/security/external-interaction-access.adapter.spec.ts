import { ExternalInteractionAccessAdapter } from '@infrastructure/oidc-provider/security/external-interaction-access.adapter';

class RedisStub {
  readonly values = new Map<string, string>();
  readonly set = jest.fn(
    async (key: string, value: string, mode: string, ttl: number) => {
      void mode;
      void ttl;
      this.values.set(key, value);
      return 'OK';
    },
  );
  readonly get = jest.fn(async (key: string) => this.values.get(key) ?? null);
  readonly eval = jest.fn(
    async (_script: string, _keys: number, key: string, accessId: string) => {
      const raw = this.values.get(key);
      if (!raw || JSON.parse(raw).accessId !== accessId) return 0;
      this.values.delete(key);
      return 1;
    },
  );
}

const binding = {
  tenantId: 'tenant-1',
  tenantCode: 'acme',
  clientId: 'web-app',
  uid: 'uid_12345678',
  origin: 'https://login.example.com',
};

function makeAdapter(redis = new RedisStub(), ttl = '300') {
  const config = {
    getOrThrow: jest.fn(() => 'cookie-key-current,cookie-key-previous'),
    get: jest.fn((key: string, defaultValue: string) =>
      key === 'EXTERNAL_INTERACTION_ACCESS_TTL_SEC' ? ttl : defaultValue,
    ),
  };
  return {
    adapter: new ExternalInteractionAccessAdapter(redis as any, config as any),
    redis,
  };
}

describe('ExternalInteractionAccessAdapter', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-11T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('서명 token, CSRF, HttpOnly browser binding을 interaction과 exact origin에 묶는다', async () => {
    const { adapter, redis } = makeAdapter();
    const issued = await adapter.issue(binding);

    await expect(
      adapter.verify({
        ...binding,
        accessToken: issued.accessToken,
        csrfToken: issued.csrfToken,
        browserBinding: issued.browserBinding,
      }),
    ).resolves.toMatchObject({
      tenantId: binding.tenantId,
      tenantCode: binding.tenantCode,
      clientId: binding.clientId,
      uid: binding.uid,
      origin: binding.origin,
    });

    const stored = [...redis.values.values()][0];
    expect(stored).not.toContain(issued.accessToken);
    expect(stored).not.toContain(issued.csrfToken);
    expect(stored).not.toContain(issued.browserBinding);
  });

  it.each([
    ['다른 tenant', { tenantCode: 'other' }],
    ['다른 client', { clientId: 'other-app' }],
    ['변조된 uid', { uid: 'uid_87654321' }],
    ['임의 origin', { origin: 'https://evil.example.com' }],
    ['잘못된 CSRF', { csrfToken: 'wrong-csrf' }],
    ['다른 browser', { browserBinding: 'wrong-browser' }],
  ])('%s binding으로 token을 재사용할 수 없다', async (_name, override) => {
    const { adapter } = makeAdapter();
    const issued = await adapter.issue(binding);

    await expect(
      adapter.verify({
        ...binding,
        accessToken: issued.accessToken,
        csrfToken: issued.csrfToken,
        browserBinding: issued.browserBinding,
        ...override,
      }),
    ).resolves.toBeNull();
  });

  it('같은 interaction에서 새 access를 발급하면 이전 token replay를 거부한다', async () => {
    const { adapter } = makeAdapter();
    const first = await adapter.issue(binding);
    await adapter.issue(binding);

    await expect(
      adapter.verify({
        ...binding,
        accessToken: first.accessToken,
        csrfToken: first.csrfToken,
        browserBinding: first.browserBinding,
      }),
    ).resolves.toBeNull();
  });

  it('interaction 완료 시 access를 원자적으로 소비하고 replay를 거부한다', async () => {
    const { adapter } = makeAdapter();
    const issued = await adapter.issue(binding);

    await expect(
      adapter.consume({
        tenantCode: binding.tenantCode,
        uid: binding.uid,
        accessId: issued.claims.accessId,
      }),
    ).resolves.toBe(true);
    await expect(
      adapter.verify({
        ...binding,
        accessToken: issued.accessToken,
        csrfToken: issued.csrfToken,
        browserBinding: issued.browserBinding,
      }),
    ).resolves.toBeNull();
  });

  it('만료 token과 허용 범위를 벗어난 TTL 설정을 거부한다', async () => {
    const { adapter } = makeAdapter();
    const issued = await adapter.issue(binding);
    jest.advanceTimersByTime(301_000);

    await expect(
      adapter.verify({
        ...binding,
        accessToken: issued.accessToken,
        csrfToken: issued.csrfToken,
        browserBinding: issued.browserBinding,
      }),
    ).resolves.toBeNull();
    expect(() => makeAdapter(new RedisStub(), '601')).toThrow(
      'EXTERNAL_INTERACTION_ACCESS_TTL_SEC_INVALID',
    );
  });
});
