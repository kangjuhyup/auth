import { MikroORM } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { randomBytes } from 'node:crypto';
import { unprotectIdpClientSecret } from '@application/services/idp-client-secret';
import { runMigrations } from '../../src/cli/migrate';
import { SymmetricCryptoAdapter } from '@infrastructure/crypto/symmetric/symmetric-crypto.adapter';
import { buildMikroOrmConfig } from '@infrastructure/mikro-orm/config/mikro-orm.config';
import { IdentityProviderOrmEntity } from '@infrastructure/mikro-orm/entities/identity-provider';

const enabled = process.env.RUN_MIGRATION_POSTGRES_INTEGRATION === '1';

(enabled ? describe : describe.skip)(
  'compiled migration runner PostgreSQL global-context regression',
  () => {
    const suffix = randomBytes(6).toString('hex');
    const tenantCode = `migration-${suffix}`;
    const provider = `migration_${suffix}`;
    const plaintextSecret = `legacy-${suffix}`;

    const openOrm = async () => {
      const config = buildMikroOrmConfig({ get: (key) => process.env[key] });
      expect(config.allowGlobalContext).not.toBe(true);
      return MikroORM.init({
        ...config,
        allowGlobalContext: false,
        extensions: [Migrator],
      });
    };

    it('retries backfill through a forked EM and remains idempotent after schema migrations', async () => {
      const encryptionKey = process.env.JWKS_ENCRYPTION_KEY;
      expect(encryptionKey).toBeTruthy();

      await runMigrations();

      let orm = await openOrm();
      try {
        const connection = orm.em.getConnection();
        const inserted = await connection.execute(
          'insert into "tenant" (code, name, created_at, updated_at) values (?, ?, now(), now()) returning id',
          [tenantCode, 'Migration Regression'],
        );
        await connection.execute(
          'insert into "identity_provider" (tenant_id, provider, protocol, display_name, client_id, client_secret, redirect_uri, enabled, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, now(), now())',
          [
            inserted[0].id,
            provider,
            'oauth2',
            'Migration Regression',
            `client-${suffix}`,
            plaintextSecret,
            `https://auth.example.test/t/${tenantCode}/interaction/idp/${provider}/callback`,
            false,
          ],
        );
      } finally {
        await orm.close(true);
      }

      await runMigrations();

      orm = await openOrm();
      let protectedSecret: string;
      try {
        await expect(
          orm.em.find(IdentityProviderOrmEntity, { provider }),
        ).rejects.toThrow(/global EntityManager/i);
        const stored = await orm.em
          .fork()
          .findOneOrFail(IdentityProviderOrmEntity, { provider });
        protectedSecret = stored.clientSecret!;
        expect(protectedSecret).toMatch(/^enc:v1:/);
        expect(
          unprotectIdpClientSecret(
            new SymmetricCryptoAdapter(encryptionKey!),
            protectedSecret,
          ),
        ).toBe(plaintextSecret);
      } finally {
        await orm.close(true);
      }

      await runMigrations();

      orm = await openOrm();
      try {
        const stored = await orm.em
          .fork()
          .findOneOrFail(IdentityProviderOrmEntity, { provider });
        expect(stored.clientSecret).toBe(protectedSecret);
      } finally {
        await orm.close(true);
      }
    }, 60_000);
  },
);
