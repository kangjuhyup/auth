import { AcmeBootstrapPort } from '@application/process-managers/ports/acme-bootstrap.port';
import { type BootstrapApplicationContext } from '../../src/cli/bootstrap-runtime';
import {
  runAcmeBootstrap,
  type AcmeBootstrapCliDependencies,
} from '../../src/cli/bootstrap-acme';

describe('acme bootstrap CLI', () => {
  it('uses one runtime context and invokes only the acme bootstrap port', async () => {
    const bootstrap = jest.fn().mockResolvedValue(undefined);
    const get = jest.fn().mockImplementation((token: unknown) => {
      if (token !== AcmeBootstrapPort) {
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
        async (options: Parameters<AcmeBootstrapCliDependencies['run']>[0]) => {
          await options.execute(appContext);
          return 0;
        },
      );

    const code = await runAcmeBootstrap({ run: runBootstrapCommand });

    expect(code).toBe(0);
    expect(runBootstrapCommand).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(AcmeBootstrapPort);
    expect(bootstrap).toHaveBeenCalledTimes(1);
    expect(bootstrap).toHaveBeenCalledWith();
    expect(runBootstrapCommand).toHaveBeenCalledWith(
      expect.objectContaining({ failureMessage: 'Acme bootstrap failed' }),
    );
  });
});
