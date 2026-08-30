import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, delimiter, join, resolve } from 'node:path';
import { ChildProcess, spawn, spawnSync } from 'node:child_process';

const entrypoint = resolve(
  __dirname,
  '../../../deploy/docker/service-entrypoint.sh',
);

describe('service Docker entrypoint', () => {
  let temporaryDirectory: string;
  let callsPath: string;
  let fakePath: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(
      join(tmpdir(), 'auth-service-entrypoint-'),
    );
    callsPath = join(temporaryDirectory, 'calls');

    const fakeBin = join(temporaryDirectory, 'bin');
    const fakeNode = join(fakeBin, 'node');
    mkdirSync(fakeBin);
    writeFileSync(
      fakeNode,
      [
        '#!/bin/sh',
        'printf "%s\\n" "$1" >> "$ENTRYPOINT_CALLS"',
        'if [ "$1" = "dist/cli/migrate.js" ]; then',
        '  exit "${MIGRATION_EXIT_CODE:-0}"',
        'fi',
        '',
      ].join('\n'),
    );
    chmodSync(fakeNode, 0o755);
    fakePath = `${fakeBin}${delimiter}${process.env.PATH ?? ''}`;
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  });

  it('returns the migration failure status without starting the service', () => {
    const result = spawnSync(
      'sh',
      [entrypoint, 'node', 'dist/main.js'],
      {
        env: {
          ...process.env,
          PATH: fakePath,
          ENTRYPOINT_CALLS: callsPath,
          MIGRATION_EXIT_CODE: '17',
        },
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(17);
    expect(readFileSync(callsPath, 'utf8')).toBe('dist/cli/migrate.js\n');
  });

  it('replaces itself with the service command so SIGTERM reaches it', async () => {
    const child = spawn(
      entrypoint,
      ['sh', '-c', 'trap "exit 42" TERM; while :; do sleep 1; done'],
      {
        detached: true,
        env: {
          ...process.env,
          PATH: fakePath,
          ENTRYPOINT_CALLS: callsPath,
          MIGRATION_EXIT_CODE: '0',
        },
        stdio: 'ignore',
      },
    );

    try {
      await waitUntil(
        () => hasDirectChildNamed(child.pid, 'sleep'),
        child,
        'the service shell to start its loop',
      );
      const exit = waitForExit(child);

      child.kill('SIGTERM');

      await expect(exit).resolves.toEqual({ code: 42, signal: null });
    } finally {
      killProcessGroup(child.pid);
    }
  });
});

async function waitUntil(
  condition: () => boolean,
  child: ChildProcess,
  description: string,
): Promise<void> {
  const deadline = Date.now() + 5_000;

  while (!condition()) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Entrypoint exited before ${description}`);
    }
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for ${description}`);
    }

    await new Promise<void>((resolvePoll) => setTimeout(resolvePoll, 10));
  }
}

function hasDirectChildNamed(
  parentPid: number | undefined,
  executableName: string,
): boolean {
  if (parentPid === undefined) {
    return false;
  }

  const result = spawnSync('ps', ['-eo', 'pid=,ppid=,comm='], {
    encoding: 'utf8',
  });

  return result.stdout.split('\n').some((line) => {
    const [pidText, ppidText, command] = line.trim().split(/\s+/);
    return (
      Number.isInteger(Number(pidText)) &&
      Number(ppidText) === parentPid &&
      basename(command ?? '') === executableName
    );
  });
}

function waitForExit(
  child: ChildProcess,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolveExit, rejectExit) => {
    const timeout = setTimeout(
      () => rejectExit(new Error('Timed out waiting for entrypoint to exit')),
      5_000,
    );

    child.once('error', (error) => {
      clearTimeout(timeout);
      rejectExit(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timeout);
      resolveExit({ code, signal });
    });
  });
}

function killProcessGroup(pid: number | undefined): void {
  if (pid === undefined) {
    return;
  }

  try {
    process.kill(-pid, 'SIGKILL');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
      throw error;
    }
  }
}
