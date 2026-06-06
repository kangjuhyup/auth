export const DB_MIGRATIONS_RUN_ON_STARTUP = 'DB_MIGRATIONS_RUN_ON_STARTUP';

type ConfigReader = {
  get(key: string): string | undefined;
};

type MikroOrmMigrationRunner = {
  migrator: {
    up(): Promise<unknown>;
  };
};

const TRUE_VALUES = new Set(['true', '1', 'yes', 'on']);
const FALSE_VALUES = new Set(['false', '0', 'no', 'off', '']);

export function shouldRunStartupMigrations(config: ConfigReader): boolean {
  const rawValue = config.get(DB_MIGRATIONS_RUN_ON_STARTUP);
  if (rawValue === undefined) {
    return false;
  }

  const normalizedValue = rawValue.trim().toLowerCase();
  if (TRUE_VALUES.has(normalizedValue)) {
    return true;
  }
  if (FALSE_VALUES.has(normalizedValue)) {
    return false;
  }

  throw new Error(
    `${DB_MIGRATIONS_RUN_ON_STARTUP} must be one of: true, false, 1, 0, yes, no, on, off`,
  );
}

export async function runStartupMigrationsIfEnabled(params: {
  config: ConfigReader;
  orm: MikroOrmMigrationRunner;
}): Promise<boolean> {
  if (!shouldRunStartupMigrations(params.config)) {
    return false;
  }

  await params.orm.migrator.up();
  return true;
}
