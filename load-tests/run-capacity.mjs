#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  appendFile,
  chmod,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { arch, cpus, platform, totalmem } from 'node:os';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { parseOptions, resolveLoadTestIdentity } from './lib/config.mjs';
import { startMonitor } from './lib/monitor.mjs';
import { runCapacityWorkflow, safeErrorMessage } from './lib/orchestrator.mjs';

const RUNTIME_SECRET_KEYS = new Set([
  'ADMIN_PASSWORD',
  'DB_PASSWORD',
  'LOAD_USER_PASSWORD',
  'JWKS_ENCRYPTION_KEY',
  'OTP_TOKEN_SECRET',
  'OIDC_COOKIE_KEYS',
  'SERVICE_CLIENT_SECRET',
]);
const CHILD_OVERRIDE_KEYS = new Set([
  'LOAD_HTTP_THROTTLE_LIMIT',
  'LOAD_LOGIN_RATE_LIMIT_IP_MAX',
]);
const COMPUTED_IDENTITY_KEYS = new Set(['LOAD_TEST_UID', 'LOAD_TEST_GID']);
const BOUNDED_ID_PATTERN = /^(?:0|[1-9]\d{0,9})$/;

export function createChildEnvironment(
  hostEnvironment,
  overrides = {},
  computedIdentity = {},
) {
  const environment = Object.fromEntries(
    Object.entries(hostEnvironment).filter(
      ([key]) =>
        !RUNTIME_SECRET_KEYS.has(key) && !COMPUTED_IDENTITY_KEYS.has(key),
    ),
  );
  for (const [key, value] of Object.entries(overrides)) {
    if (!CHILD_OVERRIDE_KEYS.has(key) || typeof value !== 'string') {
      throw new TypeError('invalid child environment override');
    }
    environment[key] = value;
  }
  for (const key of COMPUTED_IDENTITY_KEYS) {
    const value = computedIdentity[key];
    if (value === undefined) continue;
    if (
      typeof value !== 'string' ||
      !BOUNDED_ID_PATTERN.test(value) ||
      Number(value) > 2_147_483_647
    ) {
      throw new TypeError('invalid computed load-test identity');
    }
    environment[key] = value;
  }
  return environment;
}

function childEnvironment(overrides = {}) {
  return createChildEnvironment(
    process.env,
    overrides,
    resolveLoadTestIdentity(
      typeof process.getuid === 'function' ? () => process.getuid() : undefined,
      typeof process.getgid === 'function' ? () => process.getgid() : undefined,
    ),
  );
}

export function createCommandRunner({
  spawnProcess = spawn,
  now = Date.now,
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
  currentWorkingDirectory = () => process.cwd(),
  environmentForChild = childEnvironment,
} = {}) {
  return function runCommand(file, args, options = {}) {
    return new Promise((resolve, reject) => {
      const stdoutChunks = [];
      const maximumCapturedBytes = 4 * 1024 * 1024;
      let capturedBytes = 0;
      let captureOverflow = false;
      let terminalError;
      let abortTimer;
      let aborted = false;
      let child;
      const startedAtMs = now();
      if (options.signal?.aborted) {
        reject(new Error('command aborted'));
        return;
      }
      try {
        child = spawnProcess(file, args, {
          cwd: currentWorkingDirectory(),
          env: environmentForChild(options.env),
          shell: false,
          stdio: ['ignore', 'pipe', 'ignore'],
        });
      } catch {
        reject(new Error('command execution failed'));
        return;
      }
      const abort = () => {
        if (aborted) return;
        aborted = true;
        terminalError = new Error('command aborted');
        abortTimer = setTimer(() => {
          try {
            child.kill('SIGKILL');
          } catch {
            // The close event remains the sole settlement boundary.
          }
        }, 5_000);
        abortTimer?.unref?.();
        try {
          child.kill('SIGTERM');
        } catch {
          // The close event remains the sole settlement boundary.
        }
      };
      child.stdout.on('data', (chunk) => {
        if (!options.captureStdout || captureOverflow) return;
        capturedBytes += chunk.length;
        if (capturedBytes > maximumCapturedBytes) {
          captureOverflow = true;
          stdoutChunks.length = 0;
          terminalError ??= new Error(
            'captured command output exceeded the safe limit',
          );
          return;
        }
        stdoutChunks.push(chunk);
      });
      child.once('error', () => {
        terminalError ??= new Error('command execution failed');
      });
      child.once('close', (exitCode) => {
        options.signal?.removeEventListener('abort', abort);
        if (abortTimer !== undefined) clearTimer(abortTimer);
        if (terminalError || captureOverflow) {
          reject(
            terminalError ??
              new Error('captured command output exceeded the safe limit'),
          );
          return;
        }
        resolve({
          exitCode: Number.isSafeInteger(exitCode) ? exitCode : 1,
          startedAtMs,
          stdout: options.captureStdout
            ? stdoutChunks.map((chunk) => chunk.toString('utf8')).join('')
            : '',
          stderr: '',
        });
      });
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) abort();
    });
  };
}

const runCommand = createCommandRunner();

function systemInfo() {
  const processors = cpus();
  return {
    os: platform(),
    arch: arch(),
    cpuModel: processors[0]?.model,
    cpuCount: processors.length,
    memoryBytes: totalmem(),
  };
}

async function fetchHealth(url, options) {
  const response = await globalThis.fetch(url, {
    signal: options.signal,
    redirect: 'error',
  });
  const ok = response.ok;
  await response.body?.cancel();
  return ok;
}

export const nodeDependencies = Object.freeze({
  runCommand,
  fetchHealth,
  startMonitor,
  systemInfo,
  now: () => new Date(),
  randomBytes,
  writeFile,
  appendFile,
  readFile,
  mkdir,
  chmod,
  rm,
});

export async function main() {
  const controller = new globalThis.AbortController();
  const handlers = new Map();
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const handler = () => controller.abort(new Error(`aborted by ${signal}`));
    handlers.set(signal, handler);
    process.once(signal, handler);
  }

  try {
    const report = await runCapacityWorkflow(parseOptions(process.env), {
      ...nodeDependencies,
      signal: controller.signal,
    });
    process.stdout.write(`${report.summaryPath}\n`);
  } catch (error) {
    process.stderr.write(
      `Load-test harness failed: ${safeErrorMessage(error)}\n`,
    );
    process.exitCode = 1;
  } finally {
    for (const [signal, handler] of handlers)
      process.removeListener(signal, handler);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
