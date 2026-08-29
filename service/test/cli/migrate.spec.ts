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

    await runMigrations({
      readConfig: (key: string) =>
        key === 'DB_NAME' ? 'auth_test' : undefined,
      init,
    });

    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        dbName: 'auth_test',
        extensions: [Migrator],
      }),
    );
    expect(up).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith(true);
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
});
