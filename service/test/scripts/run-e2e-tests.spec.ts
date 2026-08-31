import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const serviceRoot = resolve(__dirname, '../..');

describe('runE2eTests', () => {
  it('runs default specs as separate children and forwards flags', () => {
    const bin = mkdtempSync(join(tmpdir(), 'auth-fake-yarn-'));
    const output = join(bin, 'calls');
    const yarn = join(bin, 'yarn');
    writeFileSync(
      yarn,
      '#!/bin/sh\nprintf "%s\\n" "$*" >> "$FAKE_CHILD_CALLS"\n',
    );
    chmodSync(yarn, 0o755);

    execFileSync(
      process.execPath,
      ['scripts/run-e2e-tests.mjs', '--runInBand'],
      {
        cwd: serviceRoot,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          FAKE_CHILD_CALLS: output,
        },
      },
    );

    const calls = readFileSync(output, 'utf8').trim().split('\n');
    expect(calls).toHaveLength(3);
    expect(calls.map((call) => call.split(' ').at(-1))).toEqual([
      'test/e2e/oidc.e2e-spec.ts',
      'test/e2e/user.e2e-spec.ts',
      'test/e2e/admin.e2e-spec.ts',
    ]);
    expect(calls.every((call) => call.includes('--runInBand'))).toBe(true);
  });

  it('runs only the explicitly selected spec', () => {
    const bin = mkdtempSync(join(tmpdir(), 'auth-fake-yarn-'));
    const output = join(bin, 'calls');
    const yarn = join(bin, 'yarn');
    writeFileSync(
      yarn,
      '#!/bin/sh\nprintf "%s\\n" "$*" >> "$FAKE_CHILD_CALLS"\n',
    );
    chmodSync(yarn, 0o755);

    execFileSync(
      process.execPath,
      [
        'scripts/run-e2e-tests.mjs',
        '--runInBand',
        'test/e2e/admin.e2e-spec.ts',
      ],
      {
        cwd: serviceRoot,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          FAKE_CHILD_CALLS: output,
        },
      },
    );

    const calls = readFileSync(output, 'utf8').trim().split('\n');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('--runInBand');
    expect(calls[0]).toMatch(/test\/e2e\/admin\.e2e-spec\.ts$/);
  });

  it('stops after the first failing child and propagates its exit status', () => {
    const bin = mkdtempSync(join(tmpdir(), 'auth-fake-yarn-'));
    const output = join(bin, 'calls');
    const yarn = join(bin, 'yarn');
    writeFileSync(
      yarn,
      [
        '#!/bin/sh',
        'printf "%s\\n" "$*" >> "$FAKE_CHILD_CALLS"',
        'case "$*" in',
        '  *user.e2e-spec.ts) exit 9 ;;',
        'esac',
        '',
      ].join('\n'),
    );
    chmodSync(yarn, 0o755);

    const result = spawnSync(
      process.execPath,
      ['scripts/run-e2e-tests.mjs', '--runInBand'],
      {
        cwd: serviceRoot,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          FAKE_CHILD_CALLS: output,
        },
      },
    );

    expect(result.status).toBe(9);
    const calls = readFileSync(output, 'utf8').trim().split('\n');
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatch(/test\/e2e\/oidc\.e2e-spec\.ts$/);
    expect(calls[1]).toMatch(/test\/e2e\/user\.e2e-spec\.ts$/);
  });

  it('executes when the script path contains spaces', () => {
    const bin = mkdtempSync(join(tmpdir(), 'auth fake yarn-'));
    const output = join(bin, 'calls');
    const yarn = join(bin, 'yarn');
    const scriptDirectory = mkdtempSync(join(tmpdir(), 'auth e2e script-'));
    const copiedScript = join(scriptDirectory, 'run e2e tests.mjs');
    writeFileSync(
      yarn,
      '#!/bin/sh\nprintf "%s\\n" "$*" >> "$FAKE_CHILD_CALLS"\n',
    );
    chmodSync(yarn, 0o755);
    copyFileSync(join(serviceRoot, 'scripts/run-e2e-tests.mjs'), copiedScript);

    execFileSync(
      process.execPath,
      [realpathSync(copiedScript), 'test/e2e/admin.e2e-spec.ts'],
      {
        cwd: serviceRoot,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          FAKE_CHILD_CALLS: output,
        },
      },
    );

    expect(readFileSync(output, 'utf8')).toContain(
      'test/e2e/admin.e2e-spec.ts',
    );
  });
});
