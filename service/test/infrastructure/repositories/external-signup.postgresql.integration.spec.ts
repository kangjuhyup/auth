import { IdentityUnlinkAdapter } from '@infrastructure/repositories/identity-unlink.adapter';
import { randomBytes } from 'node:crypto';
import { MikroORM, PostgreSqlDriver } from '@mikro-orm/postgresql';
import * as entities from '@infrastructure/mikro-orm/entities';
import { ExternalSignupRepository } from '@infrastructure/repositories/external-signup.repository';
import { Migration20261005000000 } from '@infrastructure/mikro-orm/migrations/postgresql/Migration20261005000000';
const enabled = Boolean(process.env.EXTERNAL_SIGNUP_TEST_DATABASE_URL);
(enabled ? describe : describe.skip)(
  'external completion atomic PostgreSQL uniqueness',
  () => {
    let orm: MikroORM;
    const schema = `auth_signup_${randomBytes(8).toString('hex')}`;
    let tenantId: string;
    beforeAll(async () => {
      orm = await MikroORM.init({
        driver: PostgreSqlDriver,
        clientUrl: process.env.EXTERNAL_SIGNUP_TEST_DATABASE_URL,
        entities: Object.values(entities),
        schema,
        allowGlobalContext: true,
      });
      await orm.schema.createSchema();
      // Verify the deployable migration against the same metadata, not only generated schema.
      await orm.em
        .getConnection()
        .execute(`drop table "${schema}"."external_signup_completion"`);
      const sql: string[] = [];
      const migration = Object.create(
        Migration20261005000000.prototype,
      ) as Migration20261005000000;
      (migration as any).addSql = (statement: string) => sql.push(statement);
      await migration.up();
      await orm.em.getConnection().execute(`set search_path to "${schema}"`);
      for (const statement of sql)
        await orm.em.getConnection().execute(statement);
      const tenant = orm.em.create(entities.TenantOrmEntity, {
        code: 'signup-test',
        name: 'Signup Test',
      });
      await orm.em.persistAndFlush(tenant);
      tenantId = tenant.id;
    }, 30000);
    afterAll(async () => {
      if (orm) {
        await orm.em
          .getConnection()
          .execute(`drop schema if exists "${schema}" cascade`);
        await orm.close(true);
      }
    });
    const request = (keyHash: string, providerSub: string) => ({
      tenantId,
      consumerClientId: 'service',
      clientId: 'app',
      keyHash,
      provider: 'kakao',
      providerSub,
      profile: {},
    });
    it('concurrent same-identity attempts produce one passwordless user and identity', async () => {
      const repository = new ExternalSignupRepository(orm.em);
      const subjects = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          repository.complete(request(`key-${i}`, 'kakao-123')),
        ),
      );
      expect(new Set(subjects).size).toBe(1);
      expect(
        await orm.em.count(entities.UserOrmEntity, { tenant: tenantId }),
      ).toBe(1);
      expect(
        await orm.em.count(entities.UserIdentityOrmEntity, {
          tenant: tenantId,
        }),
      ).toBe(1);
      expect(await orm.em.count(entities.UserCredentialOrmEntity, {})).toBe(0);
      expect(await repository.complete(request('key-0', 'kakao-123'))).toBe(
        subjects[0],
      );
    });
    it('same idempotency key cannot be replayed for another provider identity', async () => {
      const repository = new ExternalSignupRepository(orm.em);
      await expect(
        repository.complete(request('key-0', 'different-kakao')),
      ).rejects.toThrow('external_signup_conflict');
      expect(
        await orm.em.count(entities.UserOrmEntity, { tenant: tenantId }),
      ).toBe(1);
    });
    it('partial failure before identity flush rolls back the new user', async () => {
      const repository = new ExternalSignupRepository(orm.em);
      await expect(
        repository.complete({
          ...request('key-conflict', 'kakao-456'),
          providerSub: 'x'.repeat(192),
        }),
      ).rejects.toThrow();
      expect(
        await orm.em.count(entities.UserOrmEntity, { tenant: tenantId }),
      ).toBe(1);
    });
    it('simultaneous unlink requests retain at least one primary login identity', async () => {
      const subject = await new ExternalSignupRepository(orm.em).complete(
        request('key-0', 'kakao-123'),
      );
      await orm.em.persistAndFlush(
        orm.em.create(entities.UserIdentityOrmEntity, {
          tenant: orm.em.getReference(entities.TenantOrmEntity, tenantId),
          user: orm.em.getReference(entities.UserOrmEntity, subject),
          provider: 'naver',
          providerSub: 'naver-123',
          linkedAt: new Date(),
        }),
      );
      const identities = await orm.em.find(entities.UserIdentityOrmEntity, {
        user: subject,
      });
      const unlink = new IdentityUnlinkAdapter(orm.em);
      const results = await Promise.allSettled(
        identities.map((identity) =>
          unlink.remove(tenantId, subject, identity.id),
        ),
      );
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        await orm.em.count(entities.UserIdentityOrmEntity, { user: subject }),
      ).toBe(1);
      // Restore the original provider for subsequent completion recovery assertions.
      const remaining = await orm.em.findOneOrFail(
        entities.UserIdentityOrmEntity,
        { user: subject },
      );
      remaining.provider = 'kakao';
      remaining.providerSub = 'kakao-123';
      await orm.em.flush();
    });
    it('fresh ticket completion key returns same subject and rejects disabled users', async () => {
      const repository = new ExternalSignupRepository(orm.em);
      const original = await repository.complete(request('key-0', 'kakao-123'));
      expect(await repository.complete(request('fresh-key', 'kakao-123'))).toBe(
        original,
      );
      await orm.em.nativeUpdate(
        entities.UserOrmEntity,
        { id: original },
        { status: 'DISABLED' },
      );
      await expect(
        repository.complete(request('key-0', 'kakao-123')),
      ).rejects.toThrow('external_signup_user_inactive');
    });
  },
);
