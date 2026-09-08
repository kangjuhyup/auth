import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { OidcModelOrmEntity } from '@infrastructure/mikro-orm/entities/oidc-model';
import { RdbOidcAdapter } from '@infrastructure/oidc-provider/adapters/rdb-oidc.adapter';

jest.mock('@infrastructure/oidc-provider/oidc-provider.loader', () => ({
  createOidcInvalidGrantError: async (detail: string) =>
    Object.assign(new Error('invalid_grant'), {
      error: 'invalid_grant',
      error_detail: detail,
    }),
}));

const connectionUrl = process.env.OIDC_POSTGRES_TEST_URL;
const describeWithPostgres = connectionUrl ? describe : describe.skip;

describeWithPostgres('RDB OIDC single-query lookup (PostgreSQL)', () => {
  const schema = `oidc_find_${process.pid}_${Date.now()}`;
  let orm: MikroORM<PostgreSqlDriver>;

  beforeAll(async () => {
    orm = await MikroORM.init({
      driver: PostgreSqlDriver,
      clientUrl: connectionUrl,
      schema,
      entities: [OidcModelOrmEntity],
    });
    // Match the timestamp columns created by the production migrations.
    // Use an isolated schema; no application tables are reset.
    await orm.em.getConnection().execute(`create schema "${schema}"`);
    await orm.em.getConnection().execute(`create table "${schema}".oidc_model (
      tenant_id varchar(64) not null, kind varchar(64) not null, id varchar(128) not null,
      payload jsonb not null, uid varchar(128), grant_id varchar(128), user_code varchar(128),
      consumed_at timestamp, expires_at timestamp, created_at timestamp not null,
      primary key (tenant_id, kind, id)
    )`);
  });

  afterAll(async () => {
    if (!orm) return;
    await orm.em
      .getConnection()
      .execute(`drop schema if exists "${schema}" cascade`);
    await orm.close(true);
  });

  beforeEach(async () => {
    await orm.em.fork().nativeDelete(OidcModelOrmEntity, {});
  });

  async function seed(
    kind: string,
    id: string,
    options: Partial<OidcModelOrmEntity> = {},
  ) {
    await orm.em.fork().insert(OidcModelOrmEntity, {
      tenantId: 'tenant-a',
      kind,
      id,
      grantId: 'grant-1',
      payload: { sub: 'user-1' },
      expiresAt: new Date(Date.now() + 60_000),
      ...options,
      createdAt: options.createdAt ?? new Date(),
    });
  }

  it('returns a live token in one SQL statement and scopes conflict checks to its tenant', async () => {
    await seed('AccessToken', 'token-1');
    await seed('RefreshTokenReuseGrantConflict', 'grant-1', {
      tenantId: 'tenant-b',
    });
    const adapter = new RdbOidcAdapter('tenant-a', 'AccessToken', orm.em);
    const execute = jest.spyOn(orm.em.getConnection(), 'execute');
    try {
      await expect(adapter.find('token-1')).resolves.toMatchObject({
        sub: 'user-1',
      });
      expect(execute).toHaveBeenCalledTimes(1);
    } finally {
      execute.mockRestore();
    }
    await seed('RefreshTokenReuseGrantConflict', 'grant-1');
    await expect(adapter.find('token-1')).resolves.toBeUndefined();
  });

  it('keeps null-grant and non-grant-bound records visible, and hides missing/expired tokens', async () => {
    await seed('RefreshTokenReuseGrantConflict', 'grant-1');
    await seed('AccessToken', 'no-grant', { grantId: null });
    await seed('Session', 'session-1');
    await seed('AccessToken', 'expired', {
      grantId: null,
      expiresAt: new Date(0),
    });
    const adapter = new RdbOidcAdapter('tenant-a', 'AccessToken', orm.em);
    await expect(adapter.find('no-grant')).resolves.toMatchObject({
      sub: 'user-1',
    });
    await expect(adapter.find('expired')).resolves.toBeUndefined();
    await expect(adapter.find('missing')).resolves.toBeUndefined();
    await expect(
      new RdbOidcAdapter('tenant-a', 'Session', orm.em).find('session-1'),
    ).resolves.toMatchObject({ sub: 'user-1' });
  });

  it('still records reuse of a consumed refresh token while rejecting unconsumed descendants', async () => {
    await seed('RefreshToken', 'used', { consumedAt: new Date() });
    await seed('RefreshToken', 'child');
    await seed('RefreshTokenReuseGrantConflict', 'grant-1');
    const adapter = new RdbOidcAdapter('tenant-a', 'RefreshToken', orm.em);
    await expect(adapter.find('child')).resolves.toBeUndefined();
    await expect(adapter.find('used')).resolves.toMatchObject({
      consumed: true,
    });
    await expect(
      orm.em.fork().findOne(OidcModelOrmEntity, {
        tenantId: 'tenant-a',
        kind: 'RefreshTokenReuseConflict',
        id: 'used',
      }),
    ).resolves.toMatchObject({ payload: { grantId: 'grant-1' } });
  });
  it('does not record reuse for an expired consumed refresh token', async () => {
    await seed('RefreshToken', 'expired-used', {
      consumedAt: new Date(),
      expiresAt: new Date(0),
    });
    const adapter = new RdbOidcAdapter('tenant-a', 'RefreshToken', orm.em);
    await expect(adapter.find('expired-used')).resolves.toBeUndefined();
    await expect(
      orm.em.fork().findOne(OidcModelOrmEntity, {
        tenantId: 'tenant-a',
        kind: 'RefreshTokenReuseConflict',
        id: 'expired-used',
      }),
    ).resolves.toBeNull();
  });

  it('allows only one concurrent consume and fences the remaining grant family', async () => {
    await seed('Grant', 'grant-1', { grantId: null });
    await seed('RefreshToken', 'refresh-1');
    await seed('AccessToken', 'access-1');
    const refresh = new RdbOidcAdapter('tenant-a', 'RefreshToken', orm.em);
    const results = await Promise.allSettled([
      refresh.consume('refresh-1'),
      refresh.consume('refresh-1'),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    await expect(
      new RdbOidcAdapter('tenant-a', 'AccessToken', orm.em).find('access-1'),
    ).resolves.toBeUndefined();
  });
});
