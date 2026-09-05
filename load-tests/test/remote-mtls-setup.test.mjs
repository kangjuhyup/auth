import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(
  new URL('../../scripts/setup-remote-mtls.sh', import.meta.url),
);
const pemBody = /-----BEGIN [^-]*(?:CERTIFICATE|PRIVATE KEY)-----/;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(' ')} failed:\n${result.stderr}`,
  );
  return result.stdout;
}

function createFixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'remote-mtls-')));
  const checkout = join(root, 'checkout');
  mkdirSync(join(checkout, 'load-tests'), { recursive: true });
  writeFileSync(join(checkout, '.gitignore'), '/load-tests/.remote-tls/\n');
  run('git', ['init', '--initial-branch=main'], { cwd: checkout });
  run('git', ['config', 'user.email', 'load-test@example.invalid'], {
    cwd: checkout,
  });
  run('git', ['config', 'user.name', 'Load test'], { cwd: checkout });
  run('git', ['add', '.gitignore'], { cwd: checkout });
  run('git', ['commit', '-m', 'fixture'], { cwd: checkout });
  return { root, checkout };
}

function withFixture(callback) {
  const fixture = createFixture();
  try {
    callback(fixture);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
}

function outputPath(fixture, name = 'generated') {
  return join(fixture.checkout, 'load-tests', '.remote-tls', name);
}

function runSetup(fixture, args) {
  return spawnSync('bash', [scriptPath, ...args], {
    cwd: fixture.checkout,
    encoding: 'utf8',
  });
}

function opensslText(path) {
  return run('openssl', ['x509', '-in', path, '-noout', '-text']);
}

function assertSecretFree(result) {
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, pemBody);
}

test('rejects non-private or malformed target IPv4 addresses', () => {
  withFixture((fixture) => {
    const invalidTargets = [
      ['', 'empty'],
      ['0.0.0.0', 'wildcard'],
      ['127.0.0.1', 'loopback'],
      ['8.8.8.8', 'public'],
      ['192.168.0.999', 'malformed'],
    ];

    for (const [targetIp, label] of invalidTargets) {
      const output = outputPath(fixture, label);
      const result = runSetup(fixture, [
        '--target-ip',
        targetIp,
        '--output-directory',
        output,
      ]);
      assert.notEqual(result.status, 0, `${label} address was accepted`);
      assert.equal(existsSync(output), false);
      assertSecretFree(result);
    }
  });
});

test('creates a purpose-limited CA, server, and M1 client bundle', () => {
  withFixture((fixture) => {
    const output = outputPath(fixture);
    const result = runSetup(fixture, [
      '--target-ip',
      '192.168.0.18',
      '--output-directory',
      output,
    ]);

    assert.equal(result.status, 0, result.stderr);
    const expectedFiles = [
      'ca/ca.crt',
      'ca/ca.key',
      'server/server.crt',
      'server/server.key',
      'client/ca.crt',
      'client/client.crt',
      'client/client.key',
    ];
    assert.deepEqual(
      readdirSync(output, { recursive: true })
        .filter((path) => statSync(join(output, path)).isFile())
        .sort(),
      expectedFiles.sort(),
    );

    for (const directory of ['ca', 'server', 'client']) {
      assert.equal(statSync(join(output, directory)).mode & 0o777, 0o700);
    }
    for (const privateKey of [
      'ca/ca.key',
      'server/server.key',
      'client/client.key',
    ]) {
      assert.equal(statSync(join(output, privateKey)).mode & 0o777, 0o600);
      assert.match(
        run('openssl', [
          'pkey',
          '-in',
          join(output, privateKey),
          '-noout',
          '-text',
        ]),
        /Private-Key: \(3072 bit/,
      );
    }

    const caText = opensslText(join(output, 'ca/ca.crt'));
    const serverText = opensslText(join(output, 'server/server.crt'));
    const clientText = opensslText(join(output, 'client/client.crt'));
    assert.match(caText, /CA:TRUE/);
    assert.match(serverText, /DNS:auth-service/);
    assert.match(serverText, /IP Address:192\.168\.0\.18/);
    assert.match(serverText, /TLS Web Server Authentication/);
    assert.doesNotMatch(serverText, /TLS Web Client Authentication/);
    assert.match(clientText, /TLS Web Client Authentication/);
    assert.doesNotMatch(clientText, /TLS Web Server Authentication/);
    assert.equal(
      readFileSync(join(output, 'client/ca.crt'), 'utf8'),
      readFileSync(join(output, 'ca/ca.crt'), 'utf8'),
    );
    run('openssl', [
      'verify',
      '-purpose',
      'sslserver',
      '-CAfile',
      join(output, 'ca/ca.crt'),
      join(output, 'server/server.crt'),
    ]);
    run('openssl', [
      'verify',
      '-purpose',
      'sslclient',
      '-CAfile',
      join(output, 'ca/ca.crt'),
      join(output, 'client/client.crt'),
    ]);
    assertSecretFree(result);
  });
});

test('supports the default gitignored output and an existing empty destination', () => {
  withFixture((fixture) => {
    const output = join(fixture.checkout, 'load-tests', '.remote-tls');
    mkdirSync(output, { recursive: true });
    chmodSync(output, 0o700);

    const result = runSetup(fixture, ['--target-ip', '10.20.30.40']);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(output, 'client/client.key')), true);
    assert.equal(statSync(output).mode & 0o777, 0o700);
    assertSecretFree(result);
  });
});

test('rejects output paths outside the checkout remote-TLS subtree', () => {
  withFixture((fixture) => {
    for (const output of [
      join(fixture.checkout, 'outside'),
      join(fixture.checkout, 'load-tests', '.remote-tls-escape'),
    ]) {
      const result = runSetup(fixture, [
        '--target-ip',
        '172.16.0.1',
        '--output-directory',
        output,
      ]);
      assert.notEqual(result.status, 0);
      assert.equal(existsSync(output), false);
      assertSecretFree(result);
    }
  });
});

test('rejects symlinked output path components without touching their targets', () => {
  for (const kind of ['base', 'destination']) {
    withFixture((fixture) => {
      const external = join(fixture.root, `external-${kind}`);
      const tlsRoot = join(fixture.checkout, 'load-tests', '.remote-tls');
      mkdirSync(external);
      writeFileSync(join(external, 'sentinel.txt'), 'keep\n');
      if (kind === 'base') {
        symlinkSync(external, tlsRoot);
      } else {
        mkdirSync(tlsRoot);
        symlinkSync(external, join(tlsRoot, 'generated'));
      }

      const result = runSetup(fixture, [
        '--target-ip',
        '192.168.0.18',
        '--output-directory',
        outputPath(fixture),
      ]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /symbolic link/);
      assert.deepEqual(readdirSync(external), ['sentinel.txt']);
      assert.equal(
        readFileSync(join(external, 'sentinel.txt'), 'utf8'),
        'keep\n',
      );
      assertSecretFree(result);
    });
  }
});

test('rejects a nonempty destination without changing its contents', () => {
  withFixture((fixture) => {
    const output = outputPath(fixture);
    mkdirSync(output, { recursive: true });
    writeFileSync(join(output, 'sentinel.txt'), 'keep\n');

    const result = runSetup(fixture, [
      '--target-ip',
      '192.168.0.18',
      '--output-directory',
      output,
    ]);

    assert.notEqual(result.status, 0);
    assert.deepEqual(readdirSync(output), ['sentinel.txt']);
    assert.equal(readFileSync(join(output, 'sentinel.txt'), 'utf8'), 'keep\n');
    assertSecretFree(result);
  });
});
