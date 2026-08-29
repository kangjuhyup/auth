import { MikroORM, type Options } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { buildMikroOrmConfig } from '../infrastructure/mikro-orm/config/mikro-orm.config';

type MigrationOrm = {
  getMigrator(): { up(): Promise<unknown> };
  close(force?: boolean): Promise<void>;
};

export type MigrationDependencies = {
  readConfig(key: string): string | undefined;
  init(options: Options): Promise<MigrationOrm>;
};

export type MigrationCliDependencies = {
  run(): Promise<void>;
  error(message: string): void;
};

export async function runMigrations(
  deps: MigrationDependencies = {
    readConfig: (key) => process.env[key],
    init: (options) => MikroORM.init(options),
  },
): Promise<void> {
  const config = buildMikroOrmConfig({ get: deps.readConfig });
  const orm = await deps.init({ ...config, extensions: [Migrator] });
  try {
    await orm.getMigrator().up();
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
