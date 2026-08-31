import { ConfigService } from '@nestjs/config';
import { RdbOidcAdapter } from '@infrastructure/oidc-provider/adapters/rdb-oidc.adapter';
import { RedisAdapter } from '@infrastructure/oidc-provider/adapters/redis-oidc.adapter';
import { OidcSessionControlService } from '@infrastructure/oidc-provider/session/oidc-session-control.service';
import {
  RdbOidcSessionIndexStore,
  RedisOidcSessionIndexStore,
  redisSessionEntryKey,
} from '@infrastructure/oidc-provider/session/oidc-session-index.store';
import {
  InMemoryRedis,
  LightweightEntityManager,
} from '../adapter/support/in-memory-stores';

function config(driver: 'rdb' | 'redis') {
  return {
    get: jest.fn((key: string) =>
      key === 'OIDC_ADAPTER_DRIVER' ? driver : undefined,
    ),
  } as unknown as ConfigService;
}

describe('OidcSessionControlService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('RDB index로 세션을 조회하고 grant에 묶인 refresh token을 폐기한다', async () => {
    const em = new LightweightEntityManager();
    const redis = new InMemoryRedis();
    const sessionIndex = new RdbOidcSessionIndexStore(em as any, 'tenant-1');
    const sessionAdapter = new RdbOidcAdapter(
      'tenant-1',
      'Session',
      em as any,
      sessionIndex,
    );
    const refreshAdapter = new RdbOidcAdapter(
      'tenant-1',
      'RefreshToken',
      em as any,
    );
    const grantAdapter = new RdbOidcAdapter('tenant-1', 'Grant', em as any);
    const service = new OidcSessionControlService(
      em as any,
      redis as any,
      config('rdb'),
    );

    await sessionAdapter.upsert(
      'session-1',
      {
        accountId: 'user-1',
        authorizations: { 'web-app': { grantId: 'grant-1' } },
      } as any,
      3600,
    );
    await refreshAdapter.upsert(
      'refresh-1',
      { grantId: 'grant-1', accountId: 'user-1' } as any,
      3600,
    );
    await grantAdapter.upsert('grant-1', { accountId: 'user-1' } as any, 3600);

    const sessions = await service.listActiveSessions({
      tenantId: 'tenant-1',
      clientId: 'web-app',
      accountId: 'user-1',
    });

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      sessionId: 'session-1',
      grantId: 'grant-1',
    });

    await expect(
      service.listUserSessions({
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        sessionId: 'session-1',
        userId: 'user-1',
        clientId: 'web-app',
      }),
    ]);

    await service.revokeSessions(sessions);

    await expect(sessionAdapter.find('session-1')).resolves.toBeUndefined();
    await expect(refreshAdapter.find('refresh-1')).resolves.toBeUndefined();
    await expect(grantAdapter.find('grant-1')).resolves.toBeUndefined();
  });

  it('Redis index로 세션을 조회하고 grant에 묶인 refresh token을 폐기한다', async () => {
    const em = new LightweightEntityManager();
    const redis = new InMemoryRedis();
    const sessionIndex = new RedisOidcSessionIndexStore(
      redis as any,
      'tenant-1',
    );
    const sessionAdapter = new RedisAdapter(
      'tenant-1',
      'Session',
      redis as any,
      sessionIndex,
    );
    const refreshAdapter = new RedisAdapter(
      'tenant-1',
      'RefreshToken',
      redis as any,
    );
    const grantAdapter = new RedisAdapter('tenant-1', 'Grant', redis as any);
    const service = new OidcSessionControlService(
      em as any,
      redis as any,
      config('redis'),
    );

    await sessionAdapter.upsert(
      'session-1',
      {
        accountId: 'user-1',
        authorizations: { 'web-app': { grantId: 'grant-1' } },
      } as any,
      3600,
    );
    await refreshAdapter.upsert(
      'refresh-1',
      { grantId: 'grant-1', accountId: 'user-1' } as any,
      3600,
    );
    await grantAdapter.upsert('grant-1', { accountId: 'user-1' } as any, 3600);

    const sessions = await service.listActiveSessions({
      tenantId: 'tenant-1',
      clientId: 'web-app',
      accountId: 'user-1',
    });

    expect(sessions).toHaveLength(1);

    await expect(
      service.listUserSessions({
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        sessionId: 'session-1',
        userId: 'user-1',
        clientId: 'web-app',
      }),
    ]);

    await service.revokeSessions(sessions);

    await expect(sessionAdapter.find('session-1')).resolves.toBeUndefined();
    await expect(refreshAdapter.find('refresh-1')).resolves.toBeUndefined();
    await expect(grantAdapter.find('grant-1')).resolves.toBeUndefined();
  });

  it('Redis의 다중 클라이언트 세션에서 모든 grant를 조회하고 폐기한다', async () => {
    const em = new LightweightEntityManager();
    const redis = new InMemoryRedis();
    const sessionIndex = new RedisOidcSessionIndexStore(
      redis as any,
      'tenant-1',
    );
    const sessionAdapter = new RedisAdapter(
      'tenant-1',
      'Session',
      redis as any,
      sessionIndex,
    );
    const refreshAdapter = new RedisAdapter(
      'tenant-1',
      'RefreshToken',
      redis as any,
    );
    const service = new OidcSessionControlService(
      em as any,
      redis as any,
      config('redis'),
    );

    await sessionAdapter.upsert(
      'multi-client-session',
      {
        accountId: 'user-1',
        authorizations: {
          'web-app': { grantId: 'web-grant' },
          'mobile-app': { grantId: 'mobile-grant' },
        },
      } as any,
      3600,
    );
    await refreshAdapter.upsert(
      'web-refresh',
      { grantId: 'web-grant', accountId: 'user-1' } as any,
      3600,
    );
    await refreshAdapter.upsert(
      'mobile-refresh',
      { grantId: 'mobile-grant', accountId: 'user-1' } as any,
      3600,
    );

    const sessions = await service.listUserSessions({
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    expect(sessions).toHaveLength(2);
    expect(sessions.map((session) => session.clientId).sort()).toEqual([
      'mobile-app',
      'web-app',
    ]);

    await service.revokeUserSessions({
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    await expect(refreshAdapter.find('web-refresh')).resolves.toBeUndefined();
    await expect(
      refreshAdapter.find('mobile-refresh'),
    ).resolves.toBeUndefined();
  });

  it.each([
    ['tenantId', 'tenant-2'],
    ['sessionId', 'different-session'],
    ['accountId', 'different-user'],
  ] as const)(
    'Redis session index의 %s가 조회 컨텍스트와 다르면 무시한다',
    async (field, corruptedValue) => {
      const em = new LightweightEntityManager();
      const redis = new InMemoryRedis();
      const sessionIndex = new RedisOidcSessionIndexStore(
        redis as any,
        'tenant-1',
      );
      const sessionAdapter = new RedisAdapter(
        'tenant-1',
        'Session',
        redis as any,
        sessionIndex,
      );
      const service = new OidcSessionControlService(
        em as any,
        redis as any,
        config('redis'),
      );

      await sessionAdapter.upsert(
        'session-1',
        {
          accountId: 'user-1',
          authorizations: { 'web-app': { grantId: 'grant-1' } },
        } as any,
        3600,
      );

      const entryKey = redisSessionEntryKey('tenant-1', 'session-1');
      const entry = JSON.parse((await redis.get(entryKey))!);
      entry[field] = corruptedValue;
      await redis.set(entryKey, JSON.stringify(entry));

      await expect(
        service.listUserSessions({
          tenantId: 'tenant-1',
          userId: 'user-1',
        }),
      ).resolves.toEqual([]);
    },
  );

  it('RDB index에서 사용자 단일 세션만 폐기한다', async () => {
    const em = new LightweightEntityManager();
    const redis = new InMemoryRedis();
    const sessionIndex = new RdbOidcSessionIndexStore(em as any, 'tenant-1');
    const sessionAdapter = new RdbOidcAdapter(
      'tenant-1',
      'Session',
      em as any,
      sessionIndex,
    );
    const service = new OidcSessionControlService(
      em as any,
      redis as any,
      config('rdb'),
    );

    await sessionAdapter.upsert(
      'session-1',
      {
        accountId: 'user-1',
        authorizations: { 'web-app': { grantId: 'grant-1' } },
      } as any,
      3600,
    );
    await sessionAdapter.upsert(
      'session-2',
      {
        accountId: 'user-1',
        authorizations: { 'mobile-app': { grantId: 'grant-2' } },
      } as any,
      3600,
    );

    await expect(
      service.revokeUserSession({
        tenantId: 'tenant-1',
        userId: 'user-1',
        sessionId: 'session-1',
      }),
    ).resolves.toBe(1);

    await expect(sessionAdapter.find('session-1')).resolves.toBeUndefined();
    await expect(sessionAdapter.find('session-2')).resolves.toBeDefined();
  });

  it('다른 테넌트의 동일한 session/grant id를 폐기하지 않는다', async () => {
    const em = new LightweightEntityManager();
    const redis = new InMemoryRedis();
    const tenantAIndex = new RdbOidcSessionIndexStore(em as any, 'tenant-1');
    const tenantBIndex = new RdbOidcSessionIndexStore(em as any, 'tenant-2');
    const tenantASession = new RdbOidcAdapter(
      'tenant-1',
      'Session',
      em as any,
      tenantAIndex,
    );
    const tenantBSession = new RdbOidcAdapter(
      'tenant-2',
      'Session',
      em as any,
      tenantBIndex,
    );
    const tenantARefresh = new RdbOidcAdapter(
      'tenant-1',
      'RefreshToken',
      em as any,
    );
    const tenantBRefresh = new RdbOidcAdapter(
      'tenant-2',
      'RefreshToken',
      em as any,
    );
    const service = new OidcSessionControlService(
      em as any,
      redis as any,
      config('rdb'),
    );
    const payload = {
      accountId: 'shared-user',
      authorizations: { 'shared-client': { grantId: 'shared-grant' } },
    } as any;

    await tenantASession.upsert('shared-session', payload, 3600);
    await tenantBSession.upsert('shared-session', payload, 3600);
    await tenantARefresh.upsert(
      'shared-refresh',
      { grantId: 'shared-grant' } as any,
      3600,
    );
    await tenantBRefresh.upsert(
      'shared-refresh',
      { grantId: 'shared-grant' } as any,
      3600,
    );

    await service.revokeUserSessions({
      tenantId: 'tenant-2',
      userId: 'shared-user',
    });

    await expect(tenantASession.find('shared-session')).resolves.toBeDefined();
    await expect(tenantARefresh.find('shared-refresh')).resolves.toBeDefined();
    await expect(
      tenantBSession.find('shared-session'),
    ).resolves.toBeUndefined();
    await expect(
      tenantBRefresh.find('shared-refresh'),
    ).resolves.toBeUndefined();
  });

  it('Redis에서도 다른 테넌트의 동일한 session/grant id를 폐기하지 않는다', async () => {
    const em = new LightweightEntityManager();
    const redis = new InMemoryRedis();
    const tenantAIndex = new RedisOidcSessionIndexStore(
      redis as any,
      'tenant-1',
    );
    const tenantBIndex = new RedisOidcSessionIndexStore(
      redis as any,
      'tenant-2',
    );
    const tenantASession = new RedisAdapter(
      'tenant-1',
      'Session',
      redis as any,
      tenantAIndex,
    );
    const tenantBSession = new RedisAdapter(
      'tenant-2',
      'Session',
      redis as any,
      tenantBIndex,
    );
    const tenantARefresh = new RedisAdapter(
      'tenant-1',
      'RefreshToken',
      redis as any,
    );
    const tenantBRefresh = new RedisAdapter(
      'tenant-2',
      'RefreshToken',
      redis as any,
    );
    const service = new OidcSessionControlService(
      em as any,
      redis as any,
      config('redis'),
    );
    const payload = {
      accountId: 'shared-user',
      authorizations: { 'shared-client': { grantId: 'shared-grant' } },
    } as any;

    await tenantASession.upsert('shared-session', payload, 3600);
    await tenantBSession.upsert('shared-session', payload, 3600);
    await tenantARefresh.upsert(
      'shared-refresh',
      { grantId: 'shared-grant' } as any,
      3600,
    );
    await tenantBRefresh.upsert(
      'shared-refresh',
      { grantId: 'shared-grant' } as any,
      3600,
    );

    await service.revokeUserSessions({
      tenantId: 'tenant-2',
      userId: 'shared-user',
    });

    await expect(tenantASession.find('shared-session')).resolves.toBeDefined();
    await expect(tenantARefresh.find('shared-refresh')).resolves.toBeDefined();
    await expect(
      tenantBSession.find('shared-session'),
    ).resolves.toBeUndefined();
    await expect(
      tenantBRefresh.find('shared-refresh'),
    ).resolves.toBeUndefined();
  });
});
