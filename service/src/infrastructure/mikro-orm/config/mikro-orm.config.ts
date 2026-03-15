import { Options } from '@mikro-orm/core';

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

function getDriverNameFrom(config: ConfigReader): SupportedDriver {
  const raw = config.get('DB_DRIVER') ?? 'postgresql';
  if (!(raw in DRIVER_MAP)) {
    throw new Error(
      `Unsupported DB_DRIVER "${raw}". Allowed: ${Object.keys(DRIVER_MAP).join(', ')}`,
    );
  }
  return raw as SupportedDriver;
}

function buildDriverClass(driverName: SupportedDriver) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const driverModule = require(DRIVER_MAP[driverName]);
  return driverModule[DRIVER_CLASS_NAME[driverName]];
}

export function buildMikroOrmConfig(config: ConfigReader): Options {
  const driverName = getDriverNameFrom(config);
  const DriverClass = buildDriverClass(driverName);

  return {
    driver: DriverClass,
    entities: ['./dist/infrastructure/mikro-orm/entities/**/*.js'],
    entitiesTs: ['./src/infrastructure/mikro-orm/entities/**/*.ts'],
    dbName: config.get('DB_NAME') ?? 'auth',
    host: config.get('DB_HOST') ?? 'localhost',
    port: Number(config.get('DB_PORT') ?? DEFAULT_PORTS[driverName]),
    user: config.get('DB_USER') ?? 'postgres',
    password: config.get('DB_PASSWORD') ?? '',
    migrations: {
      path: `./src/infrastructure/mikro-orm/migrations/${driverName}`,
    },
  };
}

export { getDriverNameFrom, DEFAULT_PORTS };
