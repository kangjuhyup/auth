import { Migrator } from '@mikro-orm/migrations';
import { runMigrationCli, runMigrations } from '../../src/cli/migrate';

describe('compiled migration runner', () => {
  it('initializes Migrator, applies migrations, and closes the ORM', async () => {
    const up = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);
    const init = jest.fn().mockResolvedValue({
      getMigrator: () => ({ up }),
      close,
    });
    const readConfig = jest.fn((key: string) =>
      key === 'DB_NAME' ? 'auth_test' : undefined,
    );

    await runMigrations({
      readConfig,
      init,
    });

    expect(readConfig.mock.calls[0]).toEqual(['ADMIN_UI_URL']);
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        dbName: 'auth_test',
        extensions: [Migrator],
      }),
    );
    expect(up).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith(true);
  });

  it.each([
    ['empty', ''],
    ['surrounding whitespace', ' https://admin.example.test '],
    ['unapproved remote HTTP', 'http://admin.example.test'],
  ])(
    'rejects an invalid %s ADMIN_UI_URL before initializing the ORM',
    async (_case, adminUiUrl) => {
      const up = jest.fn();
      const init = jest.fn().mockResolvedValue({
        getMigrator: () => ({ up }),
        close: jest.fn(),
      });

      await expect(
        runMigrations({
          readConfig: (key) =>
            key === 'ADMIN_UI_URL' ? adminUiUrl : undefined,
          init,
        }),
      ).rejects.toMatchObject({
        code: 'ADMIN_UI_URL_INVALID',
        message: 'ADMIN_UI_URL_INVALID',
      });

      expect(init).not.toHaveBeenCalled();
      expect(up).not.toHaveBeenCalled();
    },
  );

  it('preflights a valid noncanonical raw URL unchanged before ORM configuration', async () => {
    const rawAdminUiUrl = 'https://ADMIN.EXAMPLE.TEST:443/console///';
    const readConfig = jest.fn((key: string) => {
      if (key === 'ADMIN_UI_URL') return rawAdminUiUrl;
      if (key === 'DB_NAME') return 'auth_test';
      return undefined;
    });
    const up = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);
    const init = jest.fn().mockResolvedValue({
      getMigrator: () => ({ up }),
      close,
    });

    await runMigrations({ readConfig, init });

    expect(readConfig.mock.calls[0]).toEqual(['ADMIN_UI_URL']);
    expect(readConfig).toHaveReturnedWith(rawAdminUiUrl);
    expect(init).toHaveBeenCalledTimes(1);
    expect(up).toHaveBeenCalledTimes(1);
  });

  it('closes the ORM after migration failure', async () => {
    const close = jest.fn().mockResolvedValue(undefined);
    const init = jest.fn().mockResolvedValue({
      getMigrator: () => ({
        up: jest.fn().mockRejectedValue(new Error('driver failure')),
      }),
      close,
    });

    await expect(
      runMigrations({ readConfig: () => undefined, init }),
    ).rejects.toThrow('driver failure');
    expect(close).toHaveBeenCalledWith(true);
  });

  it('returns one without logging connection details', async () => {
    const error = jest.fn();
    const code = await runMigrationCli({
      run: jest
        .fn()
        .mockRejectedValue(
          new Error('postgresql://admin:secret@database.internal/auth'),
        ),
      error,
    });

    expect(code).toBe(1);
    expect(error).toHaveBeenCalledWith('Database migration failed');
    expect(JSON.stringify(error.mock.calls)).not.toContain('secret');
    expect(JSON.stringify(error.mock.calls)).not.toContain('database.internal');
  });

  it('does not log a rejected raw ADMIN_UI_URL', async () => {
    const rawAdminUiUrl = ' https://admin.example.test/secret-path ';
    const error = jest.fn();
    const code = await runMigrationCli({
      run: jest.fn().mockRejectedValue(new Error(rawAdminUiUrl)),
      error,
    });

    expect(code).toBe(1);
    expect(error).toHaveBeenCalledWith('Database migration failed');
    expect(JSON.stringify(error.mock.calls)).not.toContain(rawAdminUiUrl);
    expect(JSON.stringify(error.mock.calls)).not.toContain('secret-path');
  });
});
