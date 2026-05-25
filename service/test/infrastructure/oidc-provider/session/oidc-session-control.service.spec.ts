import { ConfigService } from '@nestjs/config';
import { RdbOidcAdapter } from '@infrastructure/oidc-provider/adapters/rdb-oidc.adapter';
import { RedisAdapter } from '@infrastructure/oidc-provider/adapters/redis-oidc.adapter';
import { OidcSessionControlService } from '@infrastructure/oidc-provider/session/oidc-session-control.service';
import {
  RdbOidcSessionIndexStore,
  RedisOidcSessionIndexStore,
} from '@infrastructure/oidc-provider/session/oidc-session-index.store';
import {
  InMemoryRedis,
  LightweightEntityManager,
} from '../adapter/support/in-memory-stores';

const tenantRepository = {
  findByCode: jest.fn().mockResolvedValue({ id: 'tenant-1', code: 'acme' }),
};

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
    const sessionIndex = new RdbOidcSessionIndexStore(
      em as any,
      'acme',
      tenantRepository as any,
    );
    const sessionAdapter = new RdbOidcAdapter(
      'Session',
      em as any,
      sessionIndex,
    );
    const refreshAdapter = new RdbOidcAdapter('RefreshToken', em as any);
    const grantAdapter = new RdbOidcAdapter('Grant', em as any);
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
      'acme',
      tenantRepository as any,
    );
    const sessionAdapter = new RedisAdapter(
      'Session',
      redis as any,
      sessionIndex,
    );
    const refreshAdapter = new RedisAdapter('RefreshToken', redis as any);
    const grantAdapter = new RedisAdapter('Grant', redis as any);
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

    await service.revokeSessions(sessions);

    await expect(sessionAdapter.find('session-1')).resolves.toBeUndefined();
    await expect(refreshAdapter.find('refresh-1')).resolves.toBeUndefined();
    await expect(grantAdapter.find('grant-1')).resolves.toBeUndefined();
  });
});
