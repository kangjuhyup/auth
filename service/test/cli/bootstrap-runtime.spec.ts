import { MikroORM } from '@mikro-orm/core';
import {
  type BootstrapApplicationContext,
  runBootstrapCommand,
} from '../../src/cli/bootstrap-runtime';

function createAppContext(params?: {
  orm?: { em: object };
  getError?: Error;
  closeError?: Error;
}) {
  const close = jest.fn().mockImplementation(async () => {
    if (params?.closeError) {
      throw params.closeError;
    }
  });
  const get = jest.fn().mockImplementation((token: unknown) => {
    if (params?.getError) {
      throw params.getError;
    }
    if (token !== MikroORM) {
      throw new Error('Unexpected token');
    }
    return params?.orm ?? { em: {} };
  });

  return {
    appContext: { get, close } as unknown as BootstrapApplicationContext,
    close,
    get,
  };
}

describe('bootstrap runtime', () => {
  it('runs the command in one ORM request context and closes the Nest context', async () => {
    const orm = { em: {} };
    const { appContext, close, get } = createAppContext({ orm });
    const createContext = jest.fn().mockResolvedValue(appContext);
    const execute = jest.fn().mockResolvedValue(undefined);
    const requestContext = jest
      .fn()
      .mockImplementation(async (_em: object, work: () => Promise<void>) =>
        work(),
      );

    const code = await runBootstrapCommand({
      createContext,
      requestContext,
      execute,
      failureMessage: 'Acme bootstrap failed',
      error: jest.fn(),
    });

    expect(code).toBe(0);
    expect(createContext).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(MikroORM);
    expect(requestContext).toHaveBeenCalledWith(orm.em, expect.any(Function));
    expect(execute).toHaveBeenCalledWith(appContext);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('returns one with fixed output when application context creation fails', async () => {
    const error = jest.fn();
    const requestContext = jest.fn();

    const code = await runBootstrapCommand({
      createContext: jest
        .fn()
        .mockRejectedValue(
          new Error('password=secret database.internal context failure'),
        ),
      requestContext,
      execute: jest.fn(),
      failureMessage: 'Administrator bootstrap failed',
      error,
    });

    expect(code).toBe(1);
    expect(requestContext).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('Administrator bootstrap failed');
    expect(JSON.stringify(error.mock.calls)).not.toContain('secret');
    expect(JSON.stringify(error.mock.calls)).not.toContain('database.internal');
  });

  it('closes the Nest context when ORM lookup fails without logging raw details', async () => {
    const { appContext, close } = createAppContext({
      getError: new Error('postgresql://admin:secret@database.internal/auth'),
    });
    const error = jest.fn();

    const code = await runBootstrapCommand({
      createContext: jest.fn().mockResolvedValue(appContext),
      requestContext: jest.fn(),
      execute: jest.fn(),
      failureMessage: 'Acme bootstrap failed',
      error,
    });

    expect(code).toBe(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('Acme bootstrap failed');
    expect(JSON.stringify(error.mock.calls)).not.toContain('secret');
    expect(JSON.stringify(error.mock.calls)).not.toContain('database.internal');
  });

  it('closes the Nest context when request-context setup rejects', async () => {
    const { appContext, close } = createAppContext();
    const execute = jest.fn();
    const error = jest.fn();

    const code = await runBootstrapCommand({
      createContext: jest.fn().mockResolvedValue(appContext),
      requestContext: jest
        .fn()
        .mockRejectedValue(new Error('database.internal request failure')),
      execute,
      failureMessage: 'Acme bootstrap failed',
      error,
    });

    expect(code).toBe(1);
    expect(execute).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('Acme bootstrap failed');
  });

  it('closes the Nest context after execution failure and logs only fixed text', async () => {
    const { appContext, close } = createAppContext();
    const error = jest.fn();

    const code = await runBootstrapCommand({
      createContext: jest.fn().mockResolvedValue(appContext),
      requestContext: jest
        .fn()
        .mockImplementation(async (_em: object, work: () => Promise<void>) =>
          work(),
        ),
      execute: jest
        .fn()
        .mockRejectedValue(
          new Error('password=secret database.internal execute failure'),
        ),
      failureMessage: 'Administrator bootstrap failed',
      error,
    });

    expect(code).toBe(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('Administrator bootstrap failed');
    expect(JSON.stringify(error.mock.calls)).not.toContain('secret');
    expect(JSON.stringify(error.mock.calls)).not.toContain('database.internal');
  });

  it('returns one with fixed output when closing the Nest context fails', async () => {
    const { appContext, close } = createAppContext({
      closeError: new Error('password=secret database.internal close failure'),
    });
    const error = jest.fn();

    const code = await runBootstrapCommand({
      createContext: jest.fn().mockResolvedValue(appContext),
      requestContext: jest
        .fn()
        .mockImplementation(async (_em: object, work: () => Promise<void>) =>
          work(),
        ),
      execute: jest.fn().mockResolvedValue(undefined),
      failureMessage: 'Acme bootstrap failed',
      error,
    });

    expect(code).toBe(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('Acme bootstrap failed');
    expect(JSON.stringify(error.mock.calls)).not.toContain('secret');
    expect(JSON.stringify(error.mock.calls)).not.toContain('database.internal');
  });
});
