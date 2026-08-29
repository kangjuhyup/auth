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
    });
    expect(runBootstrapCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        failureMessage: 'Administrator bootstrap failed',
      }),
    );
  });

  it('uses safe defaults and preserves a root URL', async () => {
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
      readEnv: (key) => (key === 'ADMIN_UI_URL' ? '/' : undefined),
    });

    expect(bootstrap).toHaveBeenCalledWith({
      username: 'admin',
      password: undefined,
      adminUiUrl: '/',
    });
  });
});
