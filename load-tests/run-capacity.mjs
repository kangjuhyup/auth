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
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { parseOptions } from './lib/config.mjs';
import { startMonitor } from './lib/monitor.mjs';
import { runCapacityWorkflow, safeErrorMessage } from './lib/orchestrator.mjs';

function runCommand(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    const stdoutChunks = [];
    const maximumCapturedBytes = 4 * 1024 * 1024;
    let capturedBytes = 0;
    let captureOverflow = false;
    let settled = false;
    let child;
    try {
      child = spawn(file, args, {
        cwd: process.cwd(),
        env: { ...process.env, ...options.env },
        shell: false,
        signal: options.signal,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch (error) {
      reject(error);
      return;
    }
    child.stdout.on('data', (chunk) => {
      if (!options.captureStdout || captureOverflow) return;
      capturedBytes += chunk.length;
      if (capturedBytes > maximumCapturedBytes) {
        captureOverflow = true;
        stdoutChunks.length = 0;
        return;
      }
      stdoutChunks.push(chunk);
    });
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    child.once('close', (exitCode) => {
      if (settled) return;
      settled = true;
      if (captureOverflow) {
        reject(new Error('captured command output exceeded the safe limit'));
        return;
      }
      resolve({
        exitCode: Number.isSafeInteger(exitCode) ? exitCode : 1,
        stdout: options.captureStdout
          ? stdoutChunks.map((chunk) => chunk.toString('utf8')).join('')
          : '',
        stderr: '',
      });
    });
  });
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
