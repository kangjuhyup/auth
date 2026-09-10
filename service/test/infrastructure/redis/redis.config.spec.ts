import { EventEmitter } from 'node:events';
import {
  RedisConfigurationError,
  attachRedisConnectionErrorHandler,
  buildRedisConnectionConfig,
} from '@infrastructure/redis/redis.config';

type Values = Record<string, string | undefined>;

function reader(values: Values) {
  return { get: (key: string) => values[key] };
}

const tlsValues: Values = {
  REDIS_HOST: 'redis.internal.example',
  REDIS_PORT: '6380',
  REDIS_USERNAME: 'auth-app',
  REDIS_PASSWORD: 'do-not-log-password',
  REDIS_DB: '0',
  REDIS_KEY_PREFIX: 'auth',
  REDIS_TLS_ENABLED: 'true',
  REDIS_TLS_CA_CERT: 'test-ca',
  REDIS_TLS_CERT: 'test-client-cert',
  REDIS_TLS_KEY: 'test-private-key',
};

describe('Redis connection configuration', () => {
  const validateTls = jest.fn();

  beforeEach(() => validateTls.mockReset());

  it('기존 REDIS_URL 로컬 설정을 보존하면서 INFO/CLIENT handshake를 비활성화한다', () => {
    const result = buildRedisConnectionConfig(
      reader({ REDIS_URL: 'redis://localhost:6379' }),
    );

    expect(result).toEqual({
      url: 'redis://localhost:6379',
      options: {
        disableClientInfo: true,
        enableReadyCheck: false,
      },
    });
  });

  it('분리 설정을 검증된 mTLS와 정규화된 app prefix로 변환한다', () => {
    const result = buildRedisConnectionConfig(reader(tlsValues), {
      readFile: jest.fn(),
      validateTls,
    });

    expect(result.url).toBeUndefined();
    expect(result.options).toMatchObject({
      host: 'redis.internal.example',
      port: 6380,
      username: 'auth-app',
      password: 'do-not-log-password',
      db: 0,
      keyPrefix: 'auth:',
      enableReadyCheck: false,
      disableClientInfo: true,
      tls: {
        ca: 'test-ca',
        cert: 'test-client-cert',
        key: 'test-private-key',
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
        servername: 'redis.internal.example',
      },
    });
    expect(validateTls).toHaveBeenCalledTimes(1);
  });

  it('Secret file mount에서 TLS material을 읽고 inline과 file 동시 설정은 거부한다', () => {
    const readFile = jest.fn((path: string) => `material:${path}`);
    const values = {
      ...tlsValues,
      REDIS_TLS_CA_CERT: undefined,
      REDIS_TLS_CERT: undefined,
      REDIS_TLS_KEY: undefined,
      REDIS_TLS_CA_CERT_FILE: '/run/secrets/redis/ca.crt',
      REDIS_TLS_CERT_FILE: '/run/secrets/redis/tls.crt',
      REDIS_TLS_KEY_FILE: '/run/secrets/redis/tls.key',
    };

    const result = buildRedisConnectionConfig(reader(values), {
      readFile,
      validateTls,
    });

    expect(readFile).toHaveBeenCalledTimes(3);
    expect(result.options.tls).toMatchObject({
      ca: 'material:/run/secrets/redis/ca.crt',
      cert: 'material:/run/secrets/redis/tls.crt',
      key: 'material:/run/secrets/redis/tls.key',
    });

    expect(() =>
      buildRedisConnectionConfig(
        reader({
          ...values,
          REDIS_TLS_KEY: 'inline-key',
        }),
        { readFile, validateTls },
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'REDIS_TLS_KEY_SOURCE_CONFLICT',
      }),
    );
  });

  it.each([
    {
      values: { ...tlsValues, REDIS_TLS_ENABLED: 'yes' },
      code: 'REDIS_TLS_ENABLED_INVALID',
    },
    {
      values: { ...tlsValues, REDIS_TLS_KEY: undefined },
      code: 'REDIS_TLS_KEY_REQUIRED',
    },
    {
      values: { ...tlsValues, REDIS_KEY_PREFIX: 'auth:*' },
      code: 'REDIS_KEY_PREFIX_INVALID',
    },
    {
      values: { ...tlsValues, REDIS_PORT: 'not-a-port' },
      code: 'REDIS_PORT_INVALID',
    },
  ] satisfies Array<{ values: Values; code: string }>)(
    '$code로 안전하게 실패한다',
    ({ values, code }) => {
      expect(() =>
        buildRedisConnectionConfig(reader(values), {
          readFile: jest.fn(),
          validateTls,
        }),
      ).toThrow(expect.objectContaining({ code }));
    },
  );

  it('TLS parser 오류에 key material을 노출하지 않는다', () => {
    const exposed = 'private-key-that-must-not-appear';
    let thrown: unknown;
    try {
      buildRedisConnectionConfig(
        reader({ ...tlsValues, REDIS_TLS_KEY: exposed }),
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(RedisConfigurationError);
    expect(thrown).toMatchObject({ code: 'REDIS_TLS_MATERIAL_INVALID' });
    expect(String((thrown as Error).message)).not.toContain(exposed);
  });

  it('연결 오류 logger에는 URL/password/key나 원본 error를 전달하지 않는다', () => {
    const client = new EventEmitter();
    const logger = { error: jest.fn() };
    attachRedisConnectionErrorHandler(client, logger);

    client.emit(
      'error',
      new Error(
        'redis://auth-app:password@redis.internal PRIVATE KEY secret-value',
      ),
    );

    expect(logger.error).toHaveBeenCalledWith('Redis connection failed');
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('password');
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      'PRIVATE KEY',
    );
  });
});
