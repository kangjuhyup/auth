import { AdminBootstrapPort } from '@application/process-managers/ports/admin-bootstrap.port';
import { type BootstrapApplicationContext } from '../../src/cli/bootstrap-runtime';
import {
  runAdminBootstrap,
  type AdminBootstrapCliDependencies,
} from '../../src/cli/bootstrap-admin';

describe('administrator bootstrap CLI', () => {
  it('uses one runtime context and passes normalized environment input to the admin port', async () => {
    const bootstrap = jest.fn().mockResolvedValue(undefined);
    const get = jest.fn().mockImplementation((token: unknown) => {
      if (token !== AdminBootstrapPort) {
        throw new Error('Unexpected token');
      }
      return { bootstrap };
    });
    const appContext = {
      get,
      close: jest.fn(),
    } as unknown as BootstrapApplicationContext;
    const runBootstrapCommand = jest
      .fn()
      .mockImplementation(
        async (
          options: Parameters<AdminBootstrapCliDependencies['run']>[0],
        ) => {
          await options.execute(appContext);
          return 0;
        },
      );
    const environment: Record<string, string> = {
      ADMIN_USERNAME: '  operator  ',
      ADMIN_PASSWORD: ' password=secret ',
      ADMIN_UI_URL: '  https://admin.example.test///  ',
    };

    const code = await runAdminBootstrap({
      run: runBootstrapCommand,
      readEnv: (key) => environment[key],
    });

    expect(code).toBe(0);
    expect(runBootstrapCommand).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(AdminBootstrapPort);
    expect(bootstrap).toHaveBeenCalledWith({
      username: 'operator',
      password: ' password=secret ',
      adminUiUrl: 'https://admin.example.test',
      legacyMigrationAdminUiUrl: 'https://admin.example.test///',
    });
    expect(runBootstrapCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        failureMessage: 'Administrator bootstrap failed',
      }),
    );
  });

  it('uses the localhost default outside production', async () => {
    const bootstrap = jest.fn().mockResolvedValue(undefined);
    const appContext = {
      get: jest.fn().mockReturnValue({ bootstrap }),
      close: jest.fn(),
    } as unknown as BootstrapApplicationContext;
    const run = jest.fn().mockImplementation(async (options) => {
      await options.execute(appContext);
      return 0;
    });

    await runAdminBootstrap({
      run,
      readEnv: () => undefined,
    });

    expect(bootstrap).toHaveBeenCalledWith({
      username: 'admin',
      password: undefined,
      adminUiUrl: 'http://localhost:5173',
      legacyMigrationAdminUiUrl: 'http://localhost:5173',
    });
  });

  it.each([
    ['http://localhost:5173/', 'http://localhost:5173'],
    ['http://127.0.0.1:5173///', 'http://127.0.0.1:5173'],
    ['http://[::1]:5173/', 'http://[::1]:5173'],
    ['https://admin.example.test/', 'https://admin.example.test'],
    [
      'https://ADMIN.EXAMPLE.TEST:443/console///',
      'https://admin.example.test/console',
    ],
  ])(
    'accepts and normalizes the approved URL %s',
    async (adminUiUrl, canonical) => {
      const bootstrap = jest.fn().mockResolvedValue(undefined);
      const appContext = {
        get: jest.fn().mockReturnValue({ bootstrap }),
        close: jest.fn(),
      } as unknown as BootstrapApplicationContext;
      const run = jest.fn().mockImplementation(async (options) => {
        await options.execute(appContext);
        return 0;
      });

      await expect(
        runAdminBootstrap({
          run,
          readEnv: (key) =>
            key === 'ADMIN_UI_URL'
              ? adminUiUrl
              : key === 'NODE_ENV'
                ? 'production'
                : undefined,
        }),
      ).resolves.toBe(0);

      expect(bootstrap).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUiUrl: canonical,
          legacyMigrationAdminUiUrl: adminUiUrl,
        }),
      );
    },
  );

  it.each([
    ['production-missing', undefined],
    ['relative', '/admin'],
    ['non-http', 'ftp://admin.example.test'],
    ['non-local-http', 'http://admin.example.test'],
    ['credential-bearing', 'https://operator:secret@admin.example.test'],
  ])(
    'fails closed for %s ADMIN_UI_URL without invoking bootstrap',
    async (_case, adminUiUrl) => {
      const bootstrap = jest.fn();
      const appContext = {
        get: jest.fn().mockReturnValue({ bootstrap }),
        close: jest.fn(),
      } as unknown as BootstrapApplicationContext;
      let caught: unknown;
      const run = jest.fn().mockImplementation(async (options) => {
        try {
          await options.execute(appContext);
          return 0;
        } catch (error: unknown) {
          caught = error;
          return 1;
        }
      });

      const code = await runAdminBootstrap({
        run,
        readEnv: (key) =>
          key === 'ADMIN_UI_URL'
            ? adminUiUrl
            : key === 'NODE_ENV'
              ? 'production'
              : undefined,
      });

      expect(code).toBe(1);
      expect(bootstrap).not.toHaveBeenCalled();
      expect(caught).toMatchObject({ code: 'ADMIN_UI_URL_INVALID' });
      expect(JSON.stringify(caught)).not.toContain(adminUiUrl ?? 'production');
      expect(JSON.stringify(caught)).not.toContain('secret');
    },
  );
});
