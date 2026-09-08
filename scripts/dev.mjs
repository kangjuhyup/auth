import { spawn as spawnChild, spawnSync } from 'node:child_process';
import process from 'node:process';
import { createInterface } from 'node:readline';
import { setTimeout } from 'node:timers';

const components = [
  ['api', 'service:dev'],
  ['worker', 'worker:dev'],
  ['ui', 'ui:dev'],
];

function killProcessTree(pid, signal) {
  if (process.platform === 'win32') {
    // Windows has no POSIX process groups; taskkill follows the child tree.
    if (signal === 'SIGTERM') {
      spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], {
        shell: false,
        stdio: 'ignore',
      });
    }
    return;
  }
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

export function runDev({
  spawn = spawnChild,
  killTree = killProcessTree,
  signals = process,
  stdout = process.stdout,
  stderr = process.stderr,
  graceMs = 5000,
} = {}) {
  return new Promise((resolve) => {
    const children = [];
    const readers = [];
    let stopping = false;

    const killAll = (signal) => {
      for (const child of children) {
        if (!child.pid) continue;
        try {
          killTree(child.pid, signal);
        } catch (error) {
          stderr.write(
            `[dev] Could not stop process ${child.pid}: ${error.message}\n`,
          );
        }
      }
    };

    const stop = (code) => {
      if (stopping) return;
      stopping = true;
      killAll('SIGTERM');
      // Keep group IDs even after yarn exits: descendants can still be alive.
      setTimeout(() => {
        killAll('SIGKILL');
        signals.removeListener('SIGINT', onInterrupt);
        signals.removeListener('SIGTERM', onTerminate);
        readers.forEach((reader) => reader.close());
        resolve(code);
      }, graceMs);
    };
    const onInterrupt = () => stop(130);
    const onTerminate = () => stop(143);
    signals.on('SIGINT', onInterrupt);
    signals.on('SIGTERM', onTerminate);

    for (const [name, script] of components) {
      if (stopping) break;
      try {
        const yarnPath = process.env.npm_execpath;
        if (process.platform === 'win32' && !yarnPath) {
          throw new Error('Start this script with yarn dev on Windows');
        }
        const child = spawn(
          yarnPath ? process.execPath : 'yarn',
          yarnPath ? [yarnPath, script] : [script],
          {
            shell: false,
            detached: process.platform !== 'win32',
            stdio: ['ignore', 'pipe', 'pipe'],
            env: process.env,
          },
        );
        children.push(child);
        for (const [stream, output] of [
          [child.stdout, stdout],
          [child.stderr, stderr],
        ]) {
          const reader = createInterface({ input: stream });
          reader.on('line', (line) => output.write(`[${name}] ${line}\n`));
          readers.push(reader);
        }
        child.once('error', (error) => {
          stderr.write(`[${name}] Failed to start: ${error.message}\n`);
          stop(1);
        });
        child.once('exit', (code, signal) => {
          if (stopping) return;
          stderr.write(
            `[${name}] Exited unexpectedly (${signal ?? code}); stopping development processes\n`,
          );
          stop(code && code > 0 ? code : 1);
        });
      } catch (error) {
        stderr.write(`[${name}] Failed to start: ${error.message}\n`);
        stop(1);
      }
    }
  });
}

if (import.meta.main) {
  process.exitCode = await runDev();
}
