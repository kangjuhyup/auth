import { RdbOidcAdapter } from '@infrastructure/oidc-provider/adapters/rdb-oidc.adapter';
import { OidcModelOrmEntity } from '@infrastructure/mikro-orm/entities/oidc-model';
import { LightweightEntityManager } from './support/in-memory-stores';

jest.mock('@infrastructure/oidc-provider/oidc-provider.loader', () => ({
  createOidcInvalidGrantError: async (detail: string) =>
    Object.assign(new Error('invalid_grant'), {
      error: 'invalid_grant',
      error_detail: detail,
      statusCode: 400,
    }),
}));

describe('RdbOidcAdapter integration', () => {
  let em: LightweightEntityManager;
  let adapter: RdbOidcAdapter;

  beforeEach(() => {
    em = new LightweightEntityManager();
    adapter = new RdbOidcAdapter('tenant-a', 'AccessToken', em as any);
  });

  it('upsert 후 id, uid, userCode 기준으로 조회할 수 있다', async () => {
    await adapter.upsert(
      'token-1',
      {
        sub: 'user-1',
        uid: 'uid-1',
        userCode: 'code-1',
        grantId: 'grant-1',
      } as any,
      60,
    );

    await expect(adapter.find('token-1')).resolves.toMatchObject({
      sub: 'user-1',
      uid: 'uid-1',
      userCode: 'code-1',
      grantId: 'grant-1',
    });
    await expect(adapter.findByUid('uid-1')).resolves.toMatchObject({
      sub: 'user-1',
    });
    await expect(adapter.findByUserCode('code-1')).resolves.toMatchObject({
      sub: 'user-1',
    });
  });

  it('grant-bound token 조회와 conflict 검사를 한 번의 조회로 처리한다', async () => {
    await adapter.upsert('token-1', { grantId: 'grant-1', sub: 'user-1' }, 60);
    const findOne = jest.spyOn(LightweightEntityManager.prototype, 'findOne');
    try {
      await expect(adapter.find('token-1')).resolves.toMatchObject({
        sub: 'user-1',
      });
      expect(findOne).toHaveBeenCalledTimes(1);
    } finally {
      findOne.mockRestore();
    }
  });

  it('다른 테넌트의 conflict는 같은 grant ID의 토큰을 차단하지 않는다', async () => {
    await adapter.upsert('token-1', { grantId: 'shared-grant' }, 60);
    em.create(OidcModelOrmEntity, {
      tenantId: 'tenant-b',
      kind: 'RefreshTokenReuseGrantConflict',
      id: 'shared-grant',
      payload: {},
    });
    await expect(adapter.find('token-1')).resolves.toMatchObject({
      grantId: 'shared-grant',
    });
    em.create(OidcModelOrmEntity, {
      tenantId: 'tenant-a',
      kind: 'RefreshTokenReuseGrantConflict',
      id: 'shared-grant',
      payload: {},
    });
    await expect(adapter.find('token-1')).resolves.toBeUndefined();
  });

  it('이미 사용된 refresh token은 conflict가 있어도 재사용 마커를 기록한다', async () => {
    const refresh = new RdbOidcAdapter('tenant-a', 'RefreshToken', em as any);
    await refresh.upsert('used-refresh', { grantId: 'grant-1' }, 60);
    await refresh.consume('used-refresh');
    em.create(OidcModelOrmEntity, {
      tenantId: 'tenant-a',
      kind: 'RefreshTokenReuseGrantConflict',
      id: 'grant-1',
      payload: {},
    });
    await expect(refresh.find('used-refresh')).resolves.toMatchObject({
      consumed: true,
    });
    await expect(
      em.findOne(OidcModelOrmEntity, {
        tenantId: 'tenant-a',
        kind: 'RefreshTokenReuseConflict',
        id: 'used-refresh',
      }),
    ).resolves.toMatchObject({ payload: { grantId: 'grant-1' } });
  });

  it('같은 id로 다시 upsert하면 메타데이터를 갱신한다', async () => {
    await adapter.upsert(
      'token-1',
      {
        sub: 'user-1',
        uid: 'uid-1',
        userCode: 'code-1',
        grantId: 'grant-1',
      } as any,
      60,
    );

    await adapter.upsert(
      'token-1',
      {
        sub: 'user-1',
        uid: 'uid-2',
        userCode: 'code-2',
        grantId: 'grant-2',
      } as any,
      120,
    );

    await expect(adapter.findByUid('uid-1')).resolves.toBeUndefined();
    await expect(adapter.findByUserCode('code-1')).resolves.toBeUndefined();
    await expect(adapter.findByUid('uid-2')).resolves.toMatchObject({
      grantId: 'grant-2',
    });
    await expect(adapter.findByUserCode('code-2')).resolves.toMatchObject({
      uid: 'uid-2',
    });
  });

  it('만료된 데이터는 조회되지 않는다', async () => {
    await adapter.upsert(
      'token-expired',
      { uid: 'uid-expired', userCode: 'code-expired' } as any,
      -1,
    );

    await expect(adapter.find('token-expired')).resolves.toBeUndefined();
    await expect(adapter.findByUid('uid-expired')).resolves.toBeUndefined();
    await expect(
      adapter.findByUserCode('code-expired'),
    ).resolves.toBeUndefined();
  });

  it('consume 하면 consumed 플래그가 반영된다', async () => {
    await adapter.upsert('token-1', { sub: 'user-1' } as any, 60);

    await adapter.consume('token-1');

    await expect(adapter.find('token-1')).resolves.toMatchObject({
      sub: 'user-1',
      consumed: true,
    });
  });

  it('동일한 refresh token을 동시에 consume하면 정확히 하나만 성공한다', async () => {
    const refreshTokenAdapter = new RdbOidcAdapter(
      'tenant-a',
      'RefreshToken',
      em as any,
    );
    await refreshTokenAdapter.upsert(
      'refresh-token-1',
      { grantId: 'grant-1', clientId: 'e-vote' } as any,
      60,
    );
    await refreshTokenAdapter.upsert(
      'refresh-token-child',
      { grantId: 'grant-1', clientId: 'e-vote' } as any,
      120,
    );
    await adapter.upsert(
      'access-token-child',
      {
        grantId: 'grant-1',
        clientId: 'e-vote',
        uid: 'access-uid',
        userCode: 'access-code',
      } as any,
      120,
    );

    const results = await Promise.allSettled([
      refreshTokenAdapter.consume('refresh-token-1'),
      refreshTokenAdapter.consume('refresh-token-1'),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({
      status: 'rejected',
      reason: { error: 'invalid_grant', statusCode: 400 },
    });
    await expect(
      em.findOne(OidcModelOrmEntity, {
        tenantId: 'tenant-a',
        kind: 'RefreshTokenReuseConflict',
        id: 'refresh-token-1',
      }),
    ).resolves.toMatchObject({ payload: { grantId: 'grant-1' } });
    await expect(
      em.findOne(OidcModelOrmEntity, {
        tenantId: 'tenant-a',
        kind: 'RefreshTokenReuseGrantConflict',
        id: 'grant-1',
      }),
    ).resolves.toMatchObject({
      payload: { tokenId: 'refresh-token-1' },
      expiresAt: null,
    });
    await expect(
      refreshTokenAdapter.consume('refresh-token-child'),
    ).rejects.toMatchObject({ error: 'invalid_grant', statusCode: 400 });
    await expect(
      refreshTokenAdapter.find('refresh-token-child'),
    ).resolves.toBeUndefined();
    await expect(adapter.find('access-token-child')).resolves.toBeUndefined();
    await expect(adapter.findByUid('access-uid')).resolves.toBeUndefined();
    await expect(
      adapter.findByUserCode('access-code'),
    ).resolves.toBeUndefined();
  });

  it('reuse marker 뒤 늦게 저장되는 grant-bound token을 남기지 않는다', async () => {
    em.create(OidcModelOrmEntity, {
      tenantId: 'tenant-a',
      kind: 'RefreshTokenReuseGrantConflict',
      id: 'grant-1',
      payload: { tokenId: 'refresh-token-1' },
      expiresAt: new Date(Date.now() + 60_000),
    });

    await adapter.upsert(
      'late-access-token',
      { grantId: 'grant-1', clientId: 'e-vote' } as any,
      60,
    );

    await expect(adapter.find('late-access-token')).resolves.toBeUndefined();
  });

  it('destroy와 revokeByGrantId는 현재 kind 범위에서만 삭제한다', async () => {
    const accessTokenAdapter = new RdbOidcAdapter(
      'tenant-a',
      'AccessToken',
      em as any,
    );
    const sessionAdapter = new RdbOidcAdapter('tenant-a', 'Session', em as any);

    await accessTokenAdapter.upsert(
      'token-1',
      { grantId: 'grant-1', uid: 'uid-1' } as any,
      60,
    );
    await accessTokenAdapter.upsert(
      'token-2',
      { grantId: 'grant-1', uid: 'uid-2' } as any,
      60,
    );
    await sessionAdapter.upsert(
      'session-1',
      { grantId: 'grant-1', uid: 'session-uid' } as any,
      60,
    );

    await accessTokenAdapter.destroy('token-1');
    await accessTokenAdapter.revokeByGrantId('grant-1');

    await expect(accessTokenAdapter.find('token-1')).resolves.toBeUndefined();
    await expect(accessTokenAdapter.find('token-2')).resolves.toBeUndefined();
    await expect(sessionAdapter.find('session-1')).resolves.toMatchObject({
      uid: 'session-uid',
    });
  });

  it('같은 kind와 id를 사용하는 다른 테넌트의 레코드를 격리한다', async () => {
    const tenantA = new RdbOidcAdapter('tenant-a', 'AccessToken', em as any);
    const tenantB = new RdbOidcAdapter('tenant-b', 'AccessToken', em as any);

    await tenantA.upsert(
      'shared-token',
      { sub: 'user-a', uid: 'shared-uid', grantId: 'shared-grant' } as any,
      60,
    );
    await tenantB.upsert(
      'shared-token',
      { sub: 'user-b', uid: 'shared-uid', grantId: 'shared-grant' } as any,
      60,
    );

    await expect(tenantA.find('shared-token')).resolves.toMatchObject({
      sub: 'user-a',
    });
    await expect(tenantB.find('shared-token')).resolves.toMatchObject({
      sub: 'user-b',
    });

    await tenantB.revokeByGrantId('shared-grant');

    await expect(tenantA.findByUid('shared-uid')).resolves.toMatchObject({
      sub: 'user-a',
    });
    await expect(tenantB.find('shared-token')).resolves.toBeUndefined();
  });
});
