import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client as PgClient } from 'pg';
import type Redis from 'ioredis';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../../../src/app.module';
import { REDIS } from '@infrastructure/redis/redis.module';
import { OIDC_PROVIDER } from '@infrastructure/oidc-provider/oidc-provider.constants';
import { OidcProviderRegistry } from '@infrastructure/oidc-provider/oidc-provider.registry';
import { TenantRepository, ClientRepository } from '@domain/repositories';
import { ConsentRepository } from '@domain/repositories/consent.repository';
import { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';
import { configureBodyParsers } from '@presentation/http/body-parser';

type LoadedEnv = Record<string, string>;

type TestEnvironment = {
  dbDriver: string;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  redisUrl: string;
  adminUsername: string;
  adminPassword: string;
};

export type ApiE2eFixture = {
  app: INestApplication;
  orm: MikroORM;
  redis: Redis;
  registry: OidcProviderRegistry;
  tenantRepository: TenantRepository;
  clientRepository: ClientRepository;
  consentRepository: ConsentRepository;
  userWriteRepository: UserWriteRepositoryPort;
  env: TestEnvironment;
  runInRequestContext<T>(cb: () => Promise<T>): Promise<T>;
  resetPersistence(): Promise<void>;
  close(): Promise<void>;
};

function parseEnvFile(filePath: string): LoadedEnv {
  const raw = readFileSync(filePath, 'utf-8');

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .reduce<LoadedEnv>((acc, line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) {
        return acc;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
}

function resolveEnvFilePath(): string {
  const candidates = [
    process.env.E2E_ENV_FILE
      ? resolve(process.cwd(), process.env.E2E_ENV_FILE)
      : undefined,
    resolve(process.cwd(), '.env.e2e'),
    resolve(process.cwd(), 'service/.env.e2e'),
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), 'service/.env'),
    resolve(__dirname, '../../../.env.e2e'),
    resolve(__dirname, '../../../.env'),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(
      `Unable to locate .env file. Checked: ${candidates.join(', ')}`,
    );
  }

  return found;
}

function buildRedisTestUrl(redisUrl: string): string {
  const url = new URL(redisUrl);
  if (url.hostname === 'localhost') {
    url.hostname = '127.0.0.1';
  }
  url.pathname = '/15';
  return url.toString();
}

function normalizeLoopbackHost(host: string): string {
  return host === 'localhost' ? '127.0.0.1' : host;
}

function formatNestedError(error: unknown): string {
  if (error instanceof AggregateError) {
    return error.errors
      .map((entry) =>
        entry instanceof Error ? entry.stack ?? entry.message : String(entry),
      )
      .join('\n');
  }

  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

function loadTestEnvironment(): TestEnvironment {
  const envFilePath = resolveEnvFilePath();
  const envFile = parseEnvFile(envFilePath);
  const preferEnvFile = envFilePath.endsWith('.env.e2e');

  const pick = (key: string, fallback: string): string =>
    preferEnvFile
      ? process.env[`E2E_OVERRIDE_${key}`] ??
        envFile[key] ??
        process.env[key] ??
        fallback
      : process.env[key] ?? envFile[key] ?? fallback;

  const dbDriver = pick('DB_DRIVER', 'postgresql');
  const dbHost = normalizeLoopbackHost(
    pick('DB_HOST', 'localhost'),
  );
  const dbPort = Number(pick('DB_PORT', '5432'));
  const dbUser = pick('DB_USER', 'postgres');
  const dbPassword = pick('DB_PASSWORD', '');
  const baseDbName = pick('DB_NAME', 'auth');
  const redisUrl = pick('REDIS_URL', 'redis://localhost:6379');

  return {
    dbDriver,
    dbHost,
    dbPort,
    dbUser,
    dbPassword,
    dbName: process.env.E2E_DB_NAME ?? `${baseDbName}_e2e`,
    redisUrl: process.env.E2E_REDIS_URL ?? buildRedisTestUrl(redisUrl),
    adminUsername: pick('ADMIN_USERNAME', 'admin'),
    adminPassword: pick('ADMIN_PASSWORD', 'admin'),
  };
}

async function ensurePostgresDatabase(env: TestEnvironment): Promise<void> {
  if (env.dbDriver !== 'postgresql') {
    throw new Error(`Real E2E helper currently supports only PostgreSQL, got ${env.dbDriver}`);
  }

  const client = new PgClient({
    host: env.dbHost,
    port: env.dbPort,
    user: env.dbUser,
    password: env.dbPassword,
    database: 'postgres',
  });

  await client.connect();

  try {
    const result = await client.query(
      'select 1 from pg_database where datname = $1',
      [env.dbName],
    );

    if (result.rowCount === 0) {
      await client.query(`create database "${env.dbName}"`);
    }
  } finally {
    await client.end();
  }
}

function applyTestEnvironment(env: TestEnvironment): void {
  process.env.DB_DRIVER = env.dbDriver;
  process.env.DB_HOST = env.dbHost;
  process.env.DB_PORT = String(env.dbPort);
  process.env.DB_USER = env.dbUser;
  process.env.DB_PASSWORD = env.dbPassword;
  process.env.DB_NAME = env.dbName;
  process.env.REDIS_URL = env.redisUrl;
  process.env.ADMIN_USERNAME = env.adminUsername;
  process.env.ADMIN_PASSWORD = env.adminPassword;
}

function clearOidcRegistryCache(registry: OidcProviderRegistry): void {
  const providers = (registry as any).providers as Map<string, Promise<unknown>> | undefined;
  providers?.clear();
}

export async function createApiE2eFixture(): Promise<ApiE2eFixture> {
  const env = loadTestEnvironment();
  await ensurePostgresDatabase(env);
  applyTestEnvironment(env);

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
  });
  configureBodyParsers(app);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { excludeExtraneousValues: false },
    }),
  );
  await app.init();

  const orm = app.get(MikroORM);
  const redis = app.get<Redis>(REDIS as any);
  const registry = app.get<OidcProviderRegistry>(OIDC_PROVIDER as any);
  const tenantRepository = app.get(TenantRepository);
  const clientRepository = app.get(ClientRepository);
  const consentRepository = app.get(ConsentRepository);
  const userWriteRepository = app.get(UserWriteRepositoryPort);

  const resetPersistence = async (): Promise<void> => {
    let step = 'clear oidc registry';

    try {
      clearOidcRegistryCache(registry);

      step = 'flush redis db';
      await redis.flushdb();

      step = 'drop schema';
      await (orm.schema as any).dropSchema({ dropMigrationsTable: true });

      step = 'run migrations';
      await (orm.migrator as any).up();

    } catch (error) {
      throw new Error(
        `Failed to reset E2E persistence at step "${step}": ${formatNestedError(error)}`,
      );
    }
  };

  return {
    app,
    orm,
    redis,
    registry,
    tenantRepository,
    clientRepository,
    consentRepository,
    userWriteRepository,
    env,
    runInRequestContext<T>(cb: () => Promise<T>): Promise<T> {
      return RequestContext.create(orm.em, cb);
    },
    resetPersistence,
    async close() {
      let step = 'clear oidc registry';

      try {
        clearOidcRegistryCache(registry);

        step = 'flush redis db';
        await redis.flushdb();

        step = 'close app';
        await app.close();

        step = 'close orm';
        await orm.close(true);

        if (redis.status !== 'end') {
          step = 'close redis';
          await redis.quit();
        }
      } catch (error) {
        throw new Error(
          `Failed to close E2E fixture at step "${step}": ${formatNestedError(error)}`,
        );
      }
    },
  };
}
