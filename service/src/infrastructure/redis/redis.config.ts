import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import {
  createSecureContext,
  type ConnectionOptions as TlsConnectionOptions,
} from 'node:tls';
import type { RedisOptions } from 'ioredis';

type ConfigReader = {
  get(key: string): string | undefined;
};

export type RedisConnectionConfig = Readonly<{
  url?: string;
  options: RedisOptions;
}>;

type RedisConfigDependencies = Readonly<{
  readFile(path: string): string;
  validateTls(options: TlsConnectionOptions): void;
}>;

type RedisErrorEmitter = {
  on(event: 'error', listener: () => void): unknown;
};

type RedisErrorLogger = {
  error(message: string): unknown;
};

const DEFAULT_DEPENDENCIES: RedisConfigDependencies = {
  readFile: (path) => readFileSync(path, 'utf8'),
  validateTls: (options) => {
    createSecureContext(options);
  },
};

const COMPONENT_CONNECTION_KEYS = [
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_USERNAME',
  'REDIS_PASSWORD',
  'REDIS_DB',
] as const;

const TLS_MATERIAL_KEYS = [
  'REDIS_TLS_CA_CERT',
  'REDIS_TLS_CERT',
  'REDIS_TLS_KEY',
  'REDIS_TLS_CA_CERT_FILE',
  'REDIS_TLS_CERT_FILE',
  'REDIS_TLS_KEY_FILE',
] as const;

const MAX_TLS_MATERIAL_LENGTH = 1024 * 1024;

export class RedisConfigurationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'RedisConfigurationError';
  }
}

export function buildRedisConnectionConfig(
  config: ConfigReader,
  dependencies: RedisConfigDependencies = DEFAULT_DEPENDENCIES,
): RedisConnectionConfig {
  const url = optional(config, 'REDIS_URL');
  const tlsEnabled = readOptionalBoolean(config, 'REDIS_TLS_ENABLED');
  const keyPrefix = optionalPrefix(config);
  const baseOptions: RedisOptions = {
    enableReadyCheck: false,
    disableClientInfo: true,
    ...(keyPrefix ? { keyPrefix } : {}),
  };

  if (url) {
    if (COMPONENT_CONNECTION_KEYS.some((key) => optional(config, key))) {
      fail('REDIS_CONNECTION_SOURCE_CONFLICT');
    }
    const parsed = parseRedisUrl(url);
    const hasTlsMaterial = TLS_MATERIAL_KEYS.some((key) =>
      Boolean(optional(config, key)),
    );
    if (hasTlsMaterial && tlsEnabled !== true) {
      fail('REDIS_TLS_DISABLED_WITH_MATERIAL');
    }
    const tls =
      tlsEnabled === true
        ? buildMutualTls(config, parsed.hostname, dependencies)
        : parsed.protocol === 'rediss:'
          ? verifiedServerTls(parsed.hostname)
          : undefined;
    return {
      url,
      options: { ...baseOptions, ...(tls ? { tls } : {}) },
    };
  }

  const host = required(config, 'REDIS_HOST');
  const port = readInteger(config, 'REDIS_PORT', 1, 65_535);
  const username = required(config, 'REDIS_USERNAME');
  const password = required(config, 'REDIS_PASSWORD');
  const db = readInteger(config, 'REDIS_DB', 0, 2_147_483_647);
  if (!keyPrefix) fail('REDIS_KEY_PREFIX_REQUIRED');
  if (tlsEnabled !== true) fail('REDIS_TLS_REQUIRED');

  return {
    options: {
      ...baseOptions,
      host,
      port,
      username,
      password,
      db,
      keyPrefix,
      tls: buildMutualTls(config, host, dependencies),
    },
  };
}

export function attachRedisConnectionErrorHandler(
  client: RedisErrorEmitter,
  logger: RedisErrorLogger,
): void {
  client.on('error', () => {
    logger.error('Redis connection failed');
  });
}

function buildMutualTls(
  config: ConfigReader,
  host: string,
  dependencies: RedisConfigDependencies,
): TlsConnectionOptions {
  const tls: TlsConnectionOptions = {
    ca: readTlsMaterial(
      config,
      dependencies,
      'REDIS_TLS_CA_CERT',
      'REDIS_TLS_CA_CERT_FILE',
    ),
    cert: readTlsMaterial(
      config,
      dependencies,
      'REDIS_TLS_CERT',
      'REDIS_TLS_CERT_FILE',
    ),
    key: readTlsMaterial(
      config,
      dependencies,
      'REDIS_TLS_KEY',
      'REDIS_TLS_KEY_FILE',
    ),
    ...verifiedServerTls(host),
  };

  try {
    dependencies.validateTls(tls);
  } catch {
    fail('REDIS_TLS_MATERIAL_INVALID');
  }
  return tls;
}

function verifiedServerTls(host: string): TlsConnectionOptions {
  const hostname =
    host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  return {
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
    ...(isIP(hostname) === 0 ? { servername: hostname } : {}),
  };
}

function readTlsMaterial(
  config: ConfigReader,
  dependencies: RedisConfigDependencies,
  inlineKey: string,
  fileKey: string,
): string {
  const inline = optional(config, inlineKey, false);
  const file = optional(config, fileKey);
  if (inline && file) fail(`${inlineKey}_SOURCE_CONFLICT`);
  if (!inline && !file) fail(`${inlineKey}_REQUIRED`);

  let material: string;
  try {
    material = inline ?? dependencies.readFile(file as string);
  } catch {
    fail(`${inlineKey}_FILE_INVALID`);
  }
  if (!material || material.length > MAX_TLS_MATERIAL_LENGTH) {
    fail(`${inlineKey}_INVALID`);
  }
  return material;
}

function parseRedisUrl(value: string): URL {
  try {
    const parsed = new URL(value);
    if (!['redis:', 'rediss:'].includes(parsed.protocol) || !parsed.hostname) {
      fail('REDIS_URL_INVALID');
    }
    return parsed;
  } catch (error) {
    if (error instanceof RedisConfigurationError) throw error;
    fail('REDIS_URL_INVALID');
  }
}

function readOptionalBoolean(
  config: ConfigReader,
  key: string,
): boolean | undefined {
  const value = optional(config, key)?.toLowerCase();
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  fail(`${key}_INVALID`);
}

function readInteger(
  config: ConfigReader,
  key: string,
  minimum: number,
  maximum: number,
): number {
  const raw = required(config, key);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    fail(`${key}_INVALID`);
  }
  return value;
}

function optionalPrefix(config: ConfigReader): string | undefined {
  const raw = optional(config, 'REDIS_KEY_PREFIX');
  if (!raw) return undefined;
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,126}:?$/.test(raw)) {
    fail('REDIS_KEY_PREFIX_INVALID');
  }
  return raw.endsWith(':') ? raw : `${raw}:`;
}

function required(config: ConfigReader, key: string): string {
  const value = optional(config, key, key !== 'REDIS_PASSWORD');
  if (!value) fail(`${key}_REQUIRED`);
  return value;
}

function optional(
  config: ConfigReader,
  key: string,
  trim = true,
): string | undefined {
  const value = config.get(key);
  if (value === undefined) return undefined;
  const normalized = trim ? value.trim() : value;
  return normalized === '' ? undefined : normalized;
}

function fail(code: string): never {
  throw new RedisConfigurationError(code);
}
