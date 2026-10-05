import { MikroORM, type EntityManager, type Options } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { canonicalizeAdminUiUrl } from '@application/process-managers/admin-bootstrap-url';
import { buildMikroOrmConfig } from '../infrastructure/mikro-orm/config/mikro-orm.config';
import { SymmetricCryptoAdapter } from '../infrastructure/crypto/symmetric/symmetric-crypto.adapter';
import { protectStoredIdpClientSecrets } from '../infrastructure/repositories/idp-client-secret-protector';

type MigrationOrm = {
  getMigrator(): { up(): Promise<unknown> };
  em?: EntityManager;
  close(force?: boolean): Promise<void>;
};

export type MigrationDependencies = {
  readConfig(key: string): string | undefined;
  init(options: Options): Promise<MigrationOrm>;
  protectIdpSecrets?(orm: MigrationOrm): Promise<void>;
};

export type MigrationCliDependencies = {
  run(): Promise<void>;
  error(message: string): void;
};

class MigrationConfigurationError extends Error {
  readonly code = 'ADMIN_UI_URL_INVALID';

  constructor() {
    super('ADMIN_UI_URL_INVALID');
    this.name = 'MigrationConfigurationError';
  }
}

export async function runMigrations(
  deps: MigrationDependencies = {
    readConfig: (key) => process.env[key],
    init: (options) => MikroORM.init(options),
    protectIdpSecrets: async (orm) => {
      if (!orm.em) throw new Error('IdP secret protection unavailable');
      const key = process.env.JWKS_ENCRYPTION_KEY;
      if (!key) throw new Error('IdP secret protection key unavailable');
      await protectStoredIdpClientSecrets(
        orm.em,
        new SymmetricCryptoAdapter(key),
      );
    },
  },
): Promise<void> {
  const rawAdminUiUrl = deps.readConfig('ADMIN_UI_URL');
  if (
    rawAdminUiUrl !== undefined &&
    canonicalizeAdminUiUrl(rawAdminUiUrl) === null
  ) {
    throw new MigrationConfigurationError();
  }

  const config = buildMikroOrmConfig({ get: deps.readConfig });
  const orm = await deps.init({ ...config, extensions: [Migrator] });
  try {
    await orm.getMigrator().up();
    await deps.protectIdpSecrets?.(orm);
  } finally {
    await orm.close(true);
  }
}

export async function runMigrationCli(
  deps: MigrationCliDependencies = {
    run: runMigrations,
    error: console.error,
  },
): Promise<number> {
  try {
    await deps.run();
    return 0;
  } catch {
    deps.error('Database migration failed');
    return 1;
  }
}

if (require.main === module) {
  void runMigrationCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
