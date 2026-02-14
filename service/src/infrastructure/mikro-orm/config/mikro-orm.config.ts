import { Options } from '@mikro-orm/core';

export type SupportedDriver = 'postgresql' | 'mysql' | 'mssql';

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

function getDriverName(): SupportedDriver {
  const raw = process.env.DB_DRIVER ?? 'postgresql';
  if (!(raw in DRIVER_MAP)) {
    throw new Error(
      `Unsupported DB_DRIVER "${raw}". Allowed: ${Object.keys(DRIVER_MAP).join(', ')}`,
    );
  }
  return raw as SupportedDriver;
}

const driverName = getDriverName();

// eslint-disable-next-line @typescript-eslint/no-require-imports
const driverModule = require(DRIVER_MAP[driverName]);
const DriverClass = driverModule[DRIVER_CLASS_NAME[driverName]];

const config: Options = {
  driver: DriverClass,
  entities: ['./dist/infrastructure/mikro-orm/entities/**/*.js'],
  entitiesTs: ['./src/infrastructure/mikro-orm/entities/**/*.ts'],
  dbName: process.env.DB_NAME ?? 'auth',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? DEFAULT_PORTS[driverName]),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  migrations: {
    path: `./src/infrastructure/mikro-orm/migrations/${driverName}`,
  },
};

export default config;
export { getDriverName, DEFAULT_PORTS };
