import {
  buildMikroOrmConfig,
  DEFAULT_PORTS,
  getDriverNameFrom,
  resolveMikroOrmDriver,
} from '@infrastructure/mikro-orm/config/mikro-orm.config';
import { MikroORM } from '@mikro-orm/core';
import { OidcModelOrmEntity } from '@infrastructure/mikro-orm/entities/oidc-model';
import { OidcSessionIndexOrmEntity } from '@infrastructure/mikro-orm/entities/oidc-session-index';
import { CustomGrantOrmEntity } from '@infrastructure/mikro-orm/entities/custom-grant';
import { ScopeOrmEntity } from '@infrastructure/mikro-orm/entities/scope';

type ConfigValues = Record<string, string | undefined>;

function createConfigReader(values: ConfigValues = {}) {
  return {
    get: (key: string) => values[key],
  };
}

describe('buildMikroOrmConfig', () => {
  it('DB_DRIVER가 없으면 postgresql을 기본 드라이버로 사용한다', () => {
    const driver = getDriverNameFrom(createConfigReader());

    expect(driver).toBe('postgresql');
  });

  it('지원하지 않는 DB_DRIVER면 명확한 에러를 던진다', () => {
    expect(() =>
      getDriverNameFrom(createConfigReader({ DB_DRIVER: 'sqlite' })),
    ).toThrow(
      'Unsupported DB_DRIVER "sqlite". Allowed: postgresql, mysql, mssql',
    );
  });

  it('드라이버 이름에 맞는 MikroORM Driver 클래스를 반환한다', () => {
    expect(
      resolveMikroOrmDriver(createConfigReader({ DB_DRIVER: 'postgresql' }))
        .name,
    ).toBe('PostgreSqlDriver');
    expect(
      resolveMikroOrmDriver(createConfigReader({ DB_DRIVER: 'mysql' })).name,
    ).toBe('MySqlDriver');
    expect(
      resolveMikroOrmDriver(createConfigReader({ DB_DRIVER: 'mssql' })).name,
    ).toBe('MsSqlDriver');
  });

  it('기본 PostgreSQL 연결 설정과 migration 경로를 구성한다', () => {
    const config = buildMikroOrmConfig(createConfigReader());

    expect((config.driver as any).name).toBe('PostgreSqlDriver');
    expect(config.dbName).toBe('auth');
    expect(config.host).toBe('localhost');
    expect(config.port).toBe(DEFAULT_PORTS.postgresql);
    expect(config.user).toBe('postgres');
    expect(config.password).toBe('');
    expect(config.entities).toEqual(
      expect.arrayContaining([
        CustomGrantOrmEntity,
        OidcModelOrmEntity,
        OidcSessionIndexOrmEntity,
        ScopeOrmEntity,
      ]),
    );
    expect(config.entitiesTs).toEqual(config.entities);
    expect(config.migrations).toEqual({
      path: './dist/infrastructure/mikro-orm/migrations/postgresql',
      pathTs: './src/infrastructure/mikro-orm/migrations/postgresql',
    });
  });

  it('OIDC entity metadata와 tenant composite primary key를 초기화한다', async () => {
    const config = buildMikroOrmConfig(createConfigReader());
    const orm = await MikroORM.init({ ...config, connect: false });

    try {
      const model = orm.getMetadata().get(OidcModelOrmEntity.name);
      const sessionIndex = orm
        .getMetadata()
        .get(OidcSessionIndexOrmEntity.name);

      expect(model.primaryKeys).toEqual(['tenantId', 'kind', 'id']);
      expect(sessionIndex.primaryKeys).toEqual([
        'tenantId',
        'sessionId',
        'clientId',
      ]);
    } finally {
      await orm.close(true);
    }
  });

  it('커스텀 DB 설정과 mysql migration 경로를 반영한다', () => {
    const config = buildMikroOrmConfig(
      createConfigReader({
        DB_DRIVER: 'mysql',
        DB_NAME: 'auth_test',
        DB_HOST: 'mysql.internal',
        DB_PORT: '3307',
        DB_USER: 'tester',
        DB_PASSWORD: 'secret',
      }),
    );

    expect((config.driver as any).name).toBe('MySqlDriver');
    expect(config.dbName).toBe('auth_test');
    expect(config.host).toBe('mysql.internal');
    expect(config.port).toBe(3307);
    expect(config.user).toBe('tester');
    expect(config.password).toBe('secret');
    expect(config.migrations).toEqual({
      path: './dist/infrastructure/mikro-orm/migrations/mysql',
      pathTs: './src/infrastructure/mikro-orm/migrations/mysql',
    });
  });
});
