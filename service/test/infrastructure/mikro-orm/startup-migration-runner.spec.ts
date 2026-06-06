import {
  DB_MIGRATIONS_RUN_ON_STARTUP,
  runStartupMigrationsIfEnabled,
  shouldRunStartupMigrations,
} from '@infrastructure/mikro-orm/startup-migration-runner';

function createConfig(value?: string) {
  return {
    get: jest.fn((key: string) =>
      key === DB_MIGRATIONS_RUN_ON_STARTUP ? value : undefined,
    ),
  };
}

describe('startup migration runner', () => {
  it('환경변수가 없으면 service 부팅 시 migration을 실행하지 않는다', async () => {
    const orm = { migrator: { up: jest.fn() } };

    await expect(
      runStartupMigrationsIfEnabled({
        config: createConfig(),
        orm,
      }),
    ).resolves.toBe(false);

    expect(orm.migrator.up).not.toHaveBeenCalled();
  });

  it.each(['true', '1', 'yes', 'on', ' TRUE '])(
    '%s 값이면 migration을 실행한다',
    async (value) => {
      const orm = { migrator: { up: jest.fn().mockResolvedValue(undefined) } };

      await expect(
        runStartupMigrationsIfEnabled({
          config: createConfig(value),
          orm,
        }),
      ).resolves.toBe(true);

      expect(orm.migrator.up).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['false', '0', 'no', 'off', ''])(
    '%s 값이면 migration을 실행하지 않는다',
    (value) => {
      expect(shouldRunStartupMigrations(createConfig(value))).toBe(false);
    },
  );

  it('지원하지 않는 값이면 명확한 에러를 던진다', () => {
    expect(() => shouldRunStartupMigrations(createConfig('maybe'))).toThrow(
      `${DB_MIGRATIONS_RUN_ON_STARTUP} must be one of`,
    );
  });
});
