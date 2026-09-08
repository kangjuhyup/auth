import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import process from 'node:process';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { clearTimeout, setTimeout } from 'node:timers';
import { setTimeout as delay } from 'node:timers/promises';
import { runDev } from './dev.mjs';

function harness() {
  const signals = new EventEmitter();
  const children = [];
  const calls = [];
  const killed = [];
  const output = [];
  const done = runDev({
    signals,
    graceMs: 1,
    spawn(command, args, options) {
      calls.push({ command, args, options });
      const child = new EventEmitter();
      child.pid = 100 + children.length;
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      children.push(child);
      return child;
    },
    killTree(pid, signal) {
      killed.push({ pid, signal });
    },
    stdout: { write: (line) => output.push(line) },
    stderr: { write: (line) => output.push(line) },
  });
  return { signals, children, calls, killed, output, done };
}

test('starts all three components and prefixes complete output lines', async () => {
  const h = harness();
  assert.deepEqual(
    h.calls.map((call) => call.args.at(-1)),
    ['service:dev', 'worker:dev', 'ui:dev'],
  );
  assert.ok(h.calls.every((call) => call.options.shell === false));
  h.children[1].stdout.write('work');
  h.children[1].stdout.write('er ready\n');
  h.children[0].stderr.write('api warning\n');
  assert.ok(h.output.includes('[worker] worker ready\n'));
  assert.ok(h.output.includes('[api] api warning\n'));
  h.signals.emit('SIGINT');
  assert.equal(await h.done, 130);
});

test('a component exit, even success, stops every process group and fails', async () => {
  const h = harness();
  h.children[1].emit('exit', 0, null);
  assert.equal(await h.done, 1);
  for (const signal of ['SIGTERM', 'SIGKILL']) {
    assert.deepEqual(
      h.killed.filter((call) => call.signal === signal).map((call) => call.pid),
      [100, 101, 102],
    );
  }
  assert.equal(h.signals.listenerCount('SIGTERM'), 0);
});

test('termination cleans groups even after their parent exits and preserves signal status', async () => {
  const h = harness();
  h.signals.emit('SIGTERM');
  h.children.forEach((child) => child.emit('exit', 0, null));
  assert.equal(await h.done, 143);
  assert.equal(h.killed.filter((call) => call.signal === 'SIGKILL').length, 3);
});

test('spawn errors stop siblings', async () => {
  const h = harness();
  h.children[0].emit('error', new Error('unavailable'));
  assert.equal(await h.done, 1);
  assert.ok(h.output.some((line) => line.includes('unavailable')));
  assert.equal(h.killed.filter((call) => call.signal === 'SIGTERM').length, 3);
});

test(
  'POSIX shutdown kills real children and grandchildren that ignore TERM',
  {
    skip: process.platform === 'win32',
    timeout: 10000,
  },
  async () => {
    const signals = new EventEmitter();
    const pids = [];
    const children = [];
    const grandchild = `process.on('SIGTERM', () => {}); console.log(process.pid); setInterval(() => {}, 1000);`;
    const fixture = `
    const { spawn } = require('node:child_process');
    process.on('SIGTERM', () => {});
    const child = spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: ['ignore', 'pipe', 'inherit'] });
    child.stdout.on('data', (data) => console.log(process.pid + ' ' + data.toString().trim()));
  `;
    const done = runDev({
      signals,
      graceMs: 50,
      spawn(_command, _args, options) {
        const child = spawn(process.execPath, ['-e', fixture], options);
        children.push(child);
        return child;
      },
      stdout: {
        write(line) {
          pids.push(...line.trim().split(' ').slice(1).map(Number));
          if (pids.length === 6) signals.emit('SIGTERM');
        },
      },
      stderr: { write() {} },
    });
    const watchdog = setTimeout(() => signals.emit('SIGTERM'), 3000);
    try {
      assert.equal(await done, 143);
      assert.equal(pids.length, 6);
      // SIGKILL delivery and process reaping are asynchronous.
      for (let attempt = 0; attempt < 100; attempt++) {
        const alive = pids.filter((pid) => {
          try {
            process.kill(pid, 0);
            return true;
          } catch (error) {
            if (error.code === 'ESRCH') return false;
            throw error;
          }
        });
        if (alive.length === 0) return;
        await delay(10);
      }
      assert.fail('A child or grandchild survived shutdown');
    } finally {
      clearTimeout(watchdog);
      signals.emit('SIGTERM');
      for (const child of children) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch (error) {
          assert.equal(error.code, 'ESRCH');
        }
      }
    }
  },
);
