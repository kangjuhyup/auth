import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { runBootstrapMain } from '../../src/cli/bootstrap-main';

function waitForExit(
  child: ChildProcess,
  timeoutMs: number,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolveExit, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Bootstrap child did not terminate after completion'));
    }, timeoutMs);

    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      resolveExit({ code, signal });
    });
  });
}

describe('bootstrap executable main', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('forces exit one after a handled failure even with an active referenced handle', async () => {
    const previousExitCode = process.exitCode;
    const activeHandle = setInterval(() => undefined, 60_000);
    const exit = jest.fn();

    try {
      await runBootstrapMain({ run: async () => 1, exit });

      expect(exit).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledWith(1);
      expect(process.exitCode).toBe(previousExitCode);
    } finally {
      clearInterval(activeHandle);
    }
  });

  it('forces exit zero after successful completion', async () => {
    const exit = jest.fn();

    await runBootstrapMain({ run: async () => 0, exit });

    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('fails closed without exposing an unexpected run rejection', async () => {
    const exit = jest.fn();
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    await runBootstrapMain({
      run: async () => {
        throw new Error('password=secret database.internal unexpected');
      },
      exit,
    });

    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(error).not.toHaveBeenCalled();
    expect(JSON.stringify(error.mock.calls)).not.toContain('secret');
    expect(JSON.stringify(error.mock.calls)).not.toContain('database.internal');
  });

  it('imports both source wrappers without exiting', () => {
    const exit = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);

    jest.isolateModules(() => {
      jest.requireActual('../../src/cli/bootstrap-admin');
      jest.requireActual('../../src/cli/bootstrap-acme');
    });

    expect(exit).not.toHaveBeenCalled();
  });

  it.each(['bootstrap-admin.ts', 'bootstrap-acme.ts'])(
    'terminates the %s source executable promptly with an active handle',
    async (entrypoint) => {
      const preload = resolve(
        __dirname,
        'fixtures/bootstrap-wrapper-active-handle-preload.cjs',
      );
      const child = spawn(
        process.execPath,
        [
          '-r',
          'ts-node/register',
          '-r',
          'tsconfig-paths/register',
          '-r',
          preload,
          resolve(__dirname, `../../src/cli/${entrypoint}`),
        ],
        {
          cwd: resolve(__dirname, '../..'),
          env: { ...process.env, NODE_NO_WARNINGS: '1' },
          stdio: ['ignore', 'ignore', 'pipe'],
        },
      );

      const result = await waitForExit(child, 3_000);

      expect(result).toEqual({ code: 1, signal: null });
    },
  );
});
