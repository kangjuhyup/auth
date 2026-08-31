import type { Constructor, IDatabaseDriver, Options } from '@mikro-orm/core';
import * as mikroOrmEntities from '../entities';

export type SupportedDriver = 'postgresql' | 'mysql' | 'mssql';
type ConfigReader = {
  get(key: string): string | undefined;
};

const DRIVER_MAP: Record<SupportedDriver, string> = {
  postgresql: '@mikro-orm/postgresql',
  mysql: '@mikro-orm/mysql',
  mssql: '@mikro-orm/mssql',
};

const DRIVER_CLASS_NAME: Record<SupportedDriver, string> = {
  postgresql: 'PostgreSqlDriver',
  mysql: 'MySqlDriver',
  mssql: 'MsSqlDriver',
};

const DEFAULT_PORTS: Record<SupportedDriver, number> = {
  postgresql: 5432,
  mysql: 3306,
  mssql: 1433,
};

const MIKRO_ORM_ENTITIES = Object.values(
  mikroOrmEntities,
) as Constructor<object>[];

function getDriverNameFrom(config: ConfigReader): SupportedDriver {
  const raw = config.get('DB_DRIVER') ?? 'postgresql';
  if (!(raw in DRIVER_MAP)) {
    throw new Error(
      `Unsupported DB_DRIVER "${raw}". Allowed: ${Object.keys(DRIVER_MAP).join(', ')}`,
    );
  }
  return raw as SupportedDriver;
}

function buildDriverClass(
  driverName: SupportedDriver,
): Constructor<IDatabaseDriver> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const driverModule = require(DRIVER_MAP[driverName]);
  return driverModule[DRIVER_CLASS_NAME[driverName]];
}

export function resolveMikroOrmDriver(
  config: ConfigReader,
): Constructor<IDatabaseDriver> {
  return buildDriverClass(getDriverNameFrom(config));
}

export function buildMikroOrmConfig(config: ConfigReader): Options {
  const driverName = getDriverNameFrom(config);
  const DriverClass = resolveMikroOrmDriver(config);
  const logger =
    config.get('MIKRO_ORM_LOGGER') === 'silent' ? () => undefined : undefined;

  return {
    driver: DriverClass,
    entities: MIKRO_ORM_ENTITIES,
    entitiesTs: MIKRO_ORM_ENTITIES,
    dbName: config.get('DB_NAME') ?? 'auth',
    host: config.get('DB_HOST') ?? 'localhost',
    port: Number(config.get('DB_PORT') ?? DEFAULT_PORTS[driverName]),
    user: config.get('DB_USER') ?? 'postgres',
    password: config.get('DB_PASSWORD') ?? '',
    logger,
    migrations: {
      path: `./dist/infrastructure/mikro-orm/migrations/${driverName}`,
      pathTs: `./src/infrastructure/mikro-orm/migrations/${driverName}`,
    },
  };
}

export { getDriverNameFrom, DEFAULT_PORTS };
