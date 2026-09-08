import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { OidcModelOrmEntity } from '@infrastructure/mikro-orm/entities/oidc-model';
import { OidcSessionIndexOrmEntity } from '@infrastructure/mikro-orm/entities/oidc-session-index';
import { OidcCleanupStore } from '@infrastructure/oidc-provider/cleanup/oidc-cleanup.store';

const connectionUrl = process.env.OIDC_POSTGRES_TEST_URL;
(connectionUrl ? describe : describe.skip)(
  'OIDC cleanup (isolated PostgreSQL schema)',
  () => {
    const schema = `oidc_cleanup_${process.pid}_${Date.now()}`;
    const cutoff = new Date('2026-01-01T00:00:00Z');
    let orm: MikroORM<PostgreSqlDriver>;
    let store: OidcCleanupStore;
    beforeAll(async () => {
      orm = await MikroORM.init({
        driver: PostgreSqlDriver,
        clientUrl: connectionUrl,
        schema,
        entities: [OidcModelOrmEntity, OidcSessionIndexOrmEntity],
      });
      await orm.schema.createSchema();
      store = new OidcCleanupStore(orm.em);
    });
    afterAll(async () => {
      if (!orm) return;
      await orm.em
        .getConnection()
        .execute(`drop schema if exists "${schema}" cascade`);
      await orm.close(true);
    });
    beforeEach(async () => {
      await orm.em.fork().nativeDelete(OidcSessionIndexOrmEntity, {});
      await orm.em.fork().nativeDelete(OidcModelOrmEntity, {});
    });
    async function seed(
      kind: string,
      id: string,
      options: Partial<OidcModelOrmEntity> = {},
    ) {
      await orm.em.fork().insert(OidcModelOrmEntity, {
        tenantId: 'a',
        kind,
        id,
        payload: {},
        expiresAt: new Date(0),
        createdAt: new Date(),
        ...options,
      });
    }
    async function index(tenantId: string, sessionId: string) {
      await orm.em.fork().insert(OidcSessionIndexOrmEntity, {
        tenantId,
        sessionId,
        clientId: 'client',
        accountId: 'account',
        createdAt: new Date(),
      });
    }
    it('deletes only expired allowlisted rows and their tenant-scoped Session indexes', async () => {
      for (const kind of [
        'AccessToken',
        'AuthorizationCode',
        'Interaction',
        'Session',
        'Grant',
        'RefreshToken',
      ])
        await seed(kind, 'expired');
      await index('a', 'expired');
      await index('b', 'expired');
      await index('a', 'orphan');
      await seed('Session', 'expired', {
        tenantId: 'b',
        expiresAt: new Date('2030-01-01'),
      });
      await seed('RefreshTokenReuseConflict', 'marker');
      await seed('RefreshTokenReuseGrantConflict', 'grant-marker');
      await seed('AccessToken', 'null', { expiresAt: null });
      await seed('RefreshToken', 'consumed-live', {
        consumedAt: new Date(),
        expiresAt: new Date('2030-01-01'),
      });
      await seed('AccessToken', 'equal', { expiresAt: cutoff });
      expect(await store.cleanupBatch(cutoff, 100)).toEqual({
        deletedModels: 6,
        deletedSessionIndexes: 1,
      });
      expect(await orm.em.fork().count(OidcModelOrmEntity, {})).toBe(6);
      expect(await orm.em.fork().count(OidcSessionIndexOrmEntity, {})).toBe(2);
    });
    it('bounds overlapping workers and does not double-delete', async () => {
      for (let i = 0; i < 8; i++) await seed('AccessToken', `expired-${i}`);
      const results = await Promise.all([
        store.cleanupBatch(cutoff, 3),
        store.cleanupBatch(cutoff, 3),
      ]);
      expect(results.reduce((sum, value) => sum + value.deletedModels, 0)).toBe(
        6,
      );
      expect(await orm.em.fork().count(OidcModelOrmEntity, {})).toBe(2);
    });
    it('rechecks eligibility after waiting for a concurrent Session refresh', async () => {
      await seed('Session', 'refreshing');
      await index('a', 'refreshing');
      let refreshed!: () => void;
      const ready = new Promise<void>((resolve) => {
        refreshed = resolve;
      });
      let release!: () => void;
      const wait = new Promise<void>((resolve) => {
        release = resolve;
      });
      const refresh = orm.em.fork().transactional(async (tx) => {
        await tx.nativeUpdate(
          OidcModelOrmEntity,
          { tenantId: 'a', kind: 'Session', id: 'refreshing' },
          { expiresAt: new Date('2030-01-01') },
        );
        refreshed();
        await wait;
      });
      await ready;
      const cleanup = store.cleanupBatch(cutoff, 100);
      release();
      await refresh;
      expect(await cleanup).toEqual({
        deletedModels: 0,
        deletedSessionIndexes: 0,
      });
      expect(await orm.em.fork().count(OidcSessionIndexOrmEntity, {})).toBe(1);
    });
    it('bounds PostgreSQL lock waits and leaves locked rows intact', async () => {
      await seed('AccessToken', 'locked');
      let locked!: () => void;
      const ready = new Promise<void>((resolve) => {
        locked = resolve;
      });
      let release!: () => void;
      const wait = new Promise<void>((resolve) => {
        release = resolve;
      });
      const holder = orm.em.fork().transactional(async (tx) => {
        await tx.nativeUpdate(
          OidcModelOrmEntity,
          { tenantId: 'a', kind: 'AccessToken', id: 'locked' },
          { payload: { locked: true } },
        );
        locked();
        await wait;
      });
      await ready;
      try {
        await expect(store.cleanupBatch(cutoff, 100)).rejects.toThrow(
          /lock timeout/,
        );
      } finally {
        release();
        await holder;
      }
      expect(await orm.em.fork().count(OidcModelOrmEntity, {})).toBe(1);
    });
    it('rolls back the model deletion if Session index deletion fails', async () => {
      await seed('Session', 'rollback');
      await index('a', 'rollback');
      await orm.em
        .getConnection()
        .execute(
          `create function "${schema}".reject_delete() returns trigger language plpgsql as $$ begin raise exception 'test rollback'; end $$`,
        );
      await orm.em
        .getConnection()
        .execute(
          `create trigger reject_delete before delete on "${schema}".oidc_session_index for each row execute function "${schema}".reject_delete()`,
        );
      try {
        await expect(store.cleanupBatch(cutoff, 100)).rejects.toThrow(
          'test rollback',
        );
        expect(await orm.em.fork().count(OidcModelOrmEntity, {})).toBe(1);
        expect(await orm.em.fork().count(OidcSessionIndexOrmEntity, {})).toBe(
          1,
        );
      } finally {
        await orm.em
          .getConnection()
          .execute(
            `drop trigger reject_delete on "${schema}".oidc_session_index`,
          );
      }
    });
  },
);
