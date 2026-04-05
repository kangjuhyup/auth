import { RdbOidcAdapter } from '@infrastructure/oidc-provider/adapters/rdb-oidc.adapter';
import { LightweightEntityManager } from './support/in-memory-stores';

describe('RdbOidcAdapter integration', () => {
  let em: LightweightEntityManager;
  let adapter: RdbOidcAdapter;

  beforeEach(() => {
    em = new LightweightEntityManager();
    adapter = new RdbOidcAdapter('AccessToken', em as any);
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
    await expect(adapter.findByUserCode('code-expired')).resolves.toBeUndefined();
  });

  it('consume 하면 consumed 플래그가 반영된다', async () => {
    await adapter.upsert('token-1', { sub: 'user-1' } as any, 60);

    await adapter.consume('token-1');

    await expect(adapter.find('token-1')).resolves.toMatchObject({
      sub: 'user-1',
      consumed: true,
    });
  });

  it('destroy와 revokeByGrantId는 현재 kind 범위에서만 삭제한다', async () => {
    const accessTokenAdapter = new RdbOidcAdapter('AccessToken', em as any);
    const sessionAdapter = new RdbOidcAdapter('Session', em as any);

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
});
