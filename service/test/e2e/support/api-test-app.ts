import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as argon2 from 'argon2';
import { Client as PgClient } from 'pg';
import type Redis from 'ioredis';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { REDIS } from '@infrastructure/redis/redis.module';
import { OIDC_PROVIDER } from '@infrastructure/oidc-provider/oidc-provider.constants';
import { OidcProviderRegistry } from '@infrastructure/oidc-provider/oidc-provider.registry';
import { TenantRepository, ClientRepository } from '@domain/repositories';
import { ConsentRepository } from '@domain/repositories/consent.repository';
import { UserIdentityRepository } from '@domain/repositories/user-identity.repository';
import { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';
import { configureBodyParsers } from '@presentation/http/body-parser';
import { ulid } from 'ulid';

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
  userIdentityRepository: UserIdentityRepository;
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

function getE2eWorkerId(): number {
  return Number(process.env.JEST_WORKER_ID ?? '1');
}

function buildRedisTestUrl(redisUrl: string, workerId: number): string {
  const url = new URL(redisUrl);
  if (url.hostname === 'localhost') {
    url.hostname = '127.0.0.1';
  }
  const dbIndex = Math.max(0, 15 - ((workerId - 1) % 16));
  url.pathname = `/${dbIndex}`;
  return url.toString();
}

function normalizeLoopbackHost(host: string): string {
  return host === 'localhost' ? '127.0.0.1' : host;
}

function formatNestedError(error: unknown): string {
  if (error instanceof AggregateError) {
    return error.errors
      .map((entry) =>
        entry instanceof Error ? (entry.stack ?? entry.message) : String(entry),
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
      ? (process.env[`E2E_OVERRIDE_${key}`] ??
        envFile[key] ??
        process.env[key] ??
        fallback)
      : (process.env[key] ?? envFile[key] ?? fallback);

  const dbDriver = pick('DB_DRIVER', 'postgresql');
  const dbHost = normalizeLoopbackHost(pick('DB_HOST', 'localhost'));
  const dbPort = Number(pick('DB_PORT', '5432'));
  const dbUser = pick('DB_USER', 'postgres');
  const dbPassword = pick('DB_PASSWORD', '');
  const baseDbName = pick('DB_NAME', 'auth');
  const redisUrl = pick('REDIS_URL', 'redis://localhost:6379');
  const workerId = getE2eWorkerId();

  return {
    dbDriver,
    dbHost,
    dbPort,
    dbUser,
    dbPassword,
    dbName: process.env.E2E_DB_NAME ?? `${baseDbName}_e2e_${workerId}`,
    redisUrl:
      process.env.E2E_REDIS_URL ?? buildRedisTestUrl(redisUrl, workerId),
    adminUsername: pick('ADMIN_USERNAME', 'admin'),
    adminPassword: pick('ADMIN_PASSWORD', 'admin'),
  };
}

async function ensurePostgresDatabase(env: TestEnvironment): Promise<void> {
  if (env.dbDriver !== 'postgresql') {
    throw new Error(
      `Real E2E helper currently supports only PostgreSQL, got ${env.dbDriver}`,
    );
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
  process.env.RVLOG_MIN_LEVEL = process.env.RVLOG_MIN_LEVEL ?? 'ERROR';
  process.env.RVLOG_PRETTY = process.env.RVLOG_PRETTY ?? 'false';
  process.env.MIKRO_ORM_LOGGER = process.env.MIKRO_ORM_LOGGER ?? 'silent';
}

function clearOidcRegistryCache(registry: OidcProviderRegistry): void {
  const providers = (registry as any).providers as
    | Map<string, Promise<unknown>>
    | undefined;
  providers?.clear();
}

function sqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function truncateApplicationTables(orm: MikroORM): Promise<void> {
  const connection = orm.em.getConnection();
  const rows = (await connection.execute(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('mikro_orm_migrations')
    ORDER BY table_name;
  `)) as Array<{ table_name: string }>;

  if (rows.length === 0) {
    return;
  }

  const tables = rows.map((row) => quoteIdentifier(row.table_name)).join(', ');
  await connection.execute(
    `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;`,
  );
}

async function seedMasterData(
  orm: MikroORM,
  env: TestEnvironment,
): Promise<void> {
  const connection = orm.em.getConnection();
  const adminId = ulid();
  const passwordHash = await argon2.hash(env.adminPassword);
  const adminUiUrl = process.env.ADMIN_UI_URL ?? 'http://localhost:5173';
  const googleSeedOauthJson = JSON.stringify({
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userinfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: ['openid', 'email', 'profile'],
    subField: 'sub',
    emailField: 'email',
    extraAuthParams: { prompt: 'select_account' },
  });
  const base = (
    process.env.SEED_AUTH_PUBLIC_BASE ?? 'http://localhost:3000'
  ).replace(/\/$/, '');
  const googleClientId = (process.env.SEED_GOOGLE_OIDC_CLIENT_ID ?? '').trim();
  const googleSecret = (
    process.env.SEED_GOOGLE_OIDC_CLIENT_SECRET ?? ''
  ).trim();
  const googleConfigured = Boolean(googleClientId && googleSecret);
  const googleSeedClientId = googleConfigured
    ? googleClientId
    : '__configure_google_client_id__';
  const googleSeedSecret = googleConfigured
    ? `'${sqlLiteral(googleSecret)}'`
    : 'NULL';
  const googleSeedEnabled = googleConfigured ? 'true' : 'false';
  const googleRedirectUri = `${base}/t/master/interaction/seed/google/callback`;

  await connection.execute(`
    INSERT INTO "tenant" (code, name, created_at, updated_at)
    VALUES ('master', 'Master', NOW(), NOW());
  `);
  await connection.execute(`
    INSERT INTO "tenant_config" (tenant_id, signup_policy, require_phone_verify)
    SELECT id, 'invite', false
    FROM "tenant"
    WHERE code = 'master';
  `);
  await connection.execute(`
    INSERT INTO "user"
      (id, tenant_id, username, email, email_verified, phone_verified, status, created_at, updated_at)
    SELECT
      '${sqlLiteral(adminId)}',
      id,
      '${sqlLiteral(env.adminUsername)}',
      'admin@localhost',
      true,
      false,
      'ACTIVE',
      NOW(),
      NOW()
    FROM "tenant"
    WHERE code = 'master';
  `);
  await connection.execute(`
    INSERT INTO "user_credential"
      (user_id, type, secret_hash, hash_alg, hash_params, enabled, created_at, updated_at)
    VALUES
      ('${sqlLiteral(adminId)}', 'password', '${sqlLiteral(passwordHash)}', 'argon2id', '{}', true, NOW(), NOW());
  `);
  await connection.execute(`
    INSERT INTO "role" (tenant_id, code, name, description, created_at, updated_at)
    SELECT id, 'SUPER_ADMIN', 'Super Admin', '플랫폼 최고 관리자', NOW(), NOW()
    FROM "tenant"
    WHERE code = 'master';
  `);
  await connection.execute(`
    INSERT INTO "user_role" (user_id, role_id)
    SELECT '${sqlLiteral(adminId)}', r.id
    FROM "role" r
    JOIN "tenant" t ON r.tenant_id = t.id
    WHERE t.code = 'master' AND r.code = 'SUPER_ADMIN';
  `);
  await connection.execute(`
    INSERT INTO "client"
      (tenant_id, client_id, name, type, enabled,
       redirect_uris, grant_types, response_types,
       token_endpoint_auth_method, scope,
       post_logout_redirect_uris, application_type,
       skip_consent, created_at, updated_at)
    SELECT
      id, '__admin-portal__', 'Admin Portal', 'confidential', true,
      '["${sqlLiteral(adminUiUrl)}/admin/tenants"]', '["authorization_code"]', '["code"]',
      'none', 'openid profile',
      '["${sqlLiteral(adminUiUrl)}/login"]', 'web',
      true, NOW(), NOW()
    FROM "tenant"
    WHERE code = 'master';
  `);
  await connection.execute(`
    INSERT INTO "identity_provider"
      (tenant_id, provider, display_name, client_id, client_secret, redirect_uri, enabled, oauth_config, created_at, updated_at)
    SELECT
      t.id,
      'google',
      'Google',
      '${sqlLiteral(googleSeedClientId)}',
      ${googleSeedSecret},
      '${sqlLiteral(googleRedirectUri)}',
      ${googleSeedEnabled},
      '${sqlLiteral(googleSeedOauthJson)}'::jsonb,
      NOW(),
      NOW()
    FROM "tenant" t
    WHERE t.code = 'master';
  `);
}

export async function createApiE2eFixture(): Promise<ApiE2eFixture> {
  const env = loadTestEnvironment();
  await ensurePostgresDatabase(env);
  applyTestEnvironment(env);
  const { AppModule } = await import('../../../src/app.module');

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
  const userIdentityRepository = app.get(UserIdentityRepository);
  const userWriteRepository = app.get(UserWriteRepositoryPort);

  const initializePersistence = async (): Promise<void> => {
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
        `Failed to initialize E2E persistence at step "${step}": ${formatNestedError(error)}`,
      );
    }
  };

  const resetPersistence = async (): Promise<void> => {
    let step = 'clear oidc registry';

    try {
      clearOidcRegistryCache(registry);

      step = 'flush redis db';
      await redis.flushdb();

      step = 'truncate application tables';
      await truncateApplicationTables(orm);

      step = 'seed master data';
      await seedMasterData(orm, env);
    } catch (error) {
      throw new Error(
        `Failed to reset E2E persistence at step "${step}": ${formatNestedError(error)}`,
      );
    }
  };

  await initializePersistence();

  return {
    app,
    orm,
    redis,
    registry,
    tenantRepository,
    clientRepository,
    consentRepository,
    userIdentityRepository,
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
