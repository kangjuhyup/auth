import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const runnerSource = join(repositoryRoot, 'scripts/run-remote-loadgen.sh');

function writeExecutable(path, contents) {
  writeFileSync(path, contents);
  chmodSync(path, 0o755);
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'remote-loadgen-runner-'));
  const checkout = join(root, 'checkout');
  const fakeBin = join(root, 'bin');
  const dockerLog = join(root, 'docker.log');
  const clientDirectory = join(checkout, 'load-tests/.remote-tls/client');
  const resultsDirectory = join(checkout, 'load-tests/results/remote');
  const scriptsDirectory = join(checkout, 'scripts');
  const k6Directory = join(checkout, 'load-tests/k6');

  mkdirSync(fakeBin);
  mkdirSync(clientDirectory, { recursive: true });
  mkdirSync(resultsDirectory, { recursive: true });
  mkdirSync(scriptsDirectory);
  mkdirSync(k6Directory, { recursive: true });
  writeFileSync(join(checkout, 'package.json'), '{"type":"module"}\n');
  chmodSync(join(checkout, 'load-tests/.remote-tls'), 0o700);
  chmodSync(clientDirectory, 0o700);
  chmodSync(resultsDirectory, 0o700);

  for (const script of ['tls.js', 'smoke.js', 'journey.js']) {
    writeFileSync(join(k6Directory, script), '// fixture k6 script\n');
  }
  copyFileSync(
    join(repositoryRoot, 'load-tests/k6/config.js'),
    join(k6Directory, 'config.js'),
  );
  for (const certificate of ['ca.crt', 'client.crt', 'client.key']) {
    writeFileSync(
      join(clientDirectory, certificate),
      `fixture-${certificate}\n`,
    );
    chmodSync(join(clientDirectory, certificate), 0o600);
  }

  const environmentPath = join(checkout, 'load-tests/.remote-k6.env');
  writeFileSync(
    environmentPath,
    [
      'BASE_URL=https://auth-service:13443',
      'ADMIN_USERNAME=loadtest-admin',
      'ADMIN_PASSWORD=fixture-admin-password',
      'LOAD_USER_PASSWORD=fixture-load-user-password',
      'SERVICE_CLIENT_SECRET=fixture-service-client-secret',
      'UNRELATED_SECRET=must-not-be-passed',
      '',
    ].join('\n'),
  );
  chmodSync(environmentPath, 0o600);

  writeExecutable(
    join(fakeBin, 'uname'),
    `#!/bin/sh
case "$1" in
  -s) printf '%s\\n' "\${FAKE_UNAME_S:-Darwin}" ;;
  -m) printf '%s\\n' "\${FAKE_UNAME_M:-arm64}" ;;
  *) exit 1 ;;
esac
`,
  );
  writeExecutable(
    join(fakeBin, 'docker'),
    `#!/bin/sh
case "$1" in
  --version) printf '%s\\n' 'Docker version 28.0.0' ;;
  info) printf '%s\\n' 'Server: Docker Engine' ;;
  image)
    [ "$2" = inspect ] || exit 1
    printf '%s\\n' "\${K6_ARCH:-arm64}"
    ;;
  run)
    if [ "\${CHECK_SMOKE_CONFIG:-}" = 'true' ]; then
      for argument in "$@"; do
        if [ "$argument" = '/scripts/smoke.js' ]; then
          node --input-type=module --eval \
            "import { pathToFileURL } from 'node:url'; const config = await import(pathToFileURL(process.env.CONFIG_MODULE_PATH).href); config.loadScenarioConfig(process.env, 'smoke');" || exit 1
        fi
      done
    fi
    {
      printf '%s' 'RUN'
      for argument in "$@"; do printf ' <%s>' "$argument"; done
      printf '\\n'
      printf 'ENV BASE_URL=<%s> REMOTE_MTLS=<%s> VUS=<%s> WARMUP_SECONDS=<%s> MEASURE_SECONDS=<%s> RUN_KIND=<%s> SOAK_SECONDS=<%s> SUMMARY_PATH=<%s>\\n' \
        "\${BASE_URL:-}" "\${REMOTE_MTLS:-}" "\${VUS:-}" \
        "\${WARMUP_SECONDS:-}" "\${MEASURE_SECONDS:-}" \
        "\${RUN_KIND:-}" "\${SOAK_SECONDS:-}" "\${SUMMARY_PATH:-}"
    } >> "$DOCKER_LOG"
    if [ -n "\${SUMMARY_PATH:-}" ]; then
      result_host=''
      previous=''
      for argument in "$@"; do
        if [ "$previous" = '--volume' ]; then
          case "$argument" in
            *:/results) result_host="\${argument%:/results}" ;;
          esac
        fi
        previous="$argument"
      done
      [ -n "$result_host" ] || exit 1
      relative_summary="\${SUMMARY_PATH#/results/}"
      case "$relative_summary" in
        ''|/*|*..*) exit 1 ;;
      esac
      printf '%s\\n' '{}' > "$result_host/$relative_summary"
    fi
    ;;
  *) exit 1 ;;
esac
`,
  );

  spawnSync('git', ['init', '--quiet', checkout], { encoding: 'utf8' });
  if (existsSync(runnerSource)) {
    copyFileSync(runnerSource, join(scriptsDirectory, 'run-remote-loadgen.sh'));
    chmodSync(join(scriptsDirectory, 'run-remote-loadgen.sh'), 0o700);
  }

  return {
    root,
    checkout,
    dockerLog,
    environmentPath,
    clientDirectory,
    resultsDirectory,
    runnerPath: join(scriptsDirectory, 'run-remote-loadgen.sh'),
    env: {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH}`,
      DOCKER_LOG: dockerLog,
      CONFIG_MODULE_PATH: join(k6Directory, 'config.js'),
    },
  };
}

function withFixture(callback) {
  const fixture = createFixture();
  try {
    callback(fixture);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runRunner(fixture, args, environment = {}) {
  assert.equal(
    existsSync(fixture.runnerPath),
    true,
    'production runner must exist before its behavior can be exercised',
  );
  return spawnSync('bash', [fixture.runnerPath, ...args], {
    cwd: fixture.checkout,
    encoding: 'utf8',
    env: { ...fixture.env, ...environment },
  });
}

function dockerLog(fixture) {
  return existsSync(fixture.dockerLog)
    ? readFileSync(fixture.dockerLog, 'utf8')
    : '';
}

function summaries(fixture) {
  return readdirSync(fixture.resultsDirectory).filter((entry) =>
    entry.endsWith('.json'),
  );
}

function assertCommonRemoteBoundary(log) {
  assert.match(log, /<--add-host> <auth-service:192\.168\.0\.18>/);
  assert.match(log, /<grafana\/k6:2\.2\.0>/);
  assert.match(log, /<[^>]+\/load-tests\/k6:\/scripts:ro>/);
  assert.match(log, /<[^>]+\/\.remote-tls\/client:\/certs:ro>/);
  assert.match(
    log,
    /<[^>]+\/client\/ca\.crt:\/etc\/ssl\/certs\/ca-certificates\.crt:ro>/,
  );
  assert.match(log, /<[^>]+\/results\/remote:\/results>/);
  assert.match(log, /<--env> <BASE_URL>/);
  assert.match(log, /<--env> <REMOTE_MTLS>/);
  assert.match(log, /<--env> <ADMIN_USERNAME>/);
  assert.match(log, /<--env> <ADMIN_PASSWORD>/);
  assert.match(log, /<--env> <LOAD_USER_PASSWORD>/);
  assert.match(log, /<--env> <SERVICE_CLIENT_SECRET>/);
  assert.doesNotMatch(log, /UNRELATED_SECRET/);
  assert.doesNotMatch(log, /insecure-skip-tls-verify/i);
  assert.doesNotMatch(log, /fixture-(?:admin|load-user|service-client)/);
}

test('verify performs one mTLS health request before deterministic OIDC smoke', () => {
  withFixture((fixture) => {
    const result = runRunner(fixture, [
      'verify',
      '--target-ip',
      '192.168.0.18',
    ]);
    assert.equal(result.status, 0, result.stderr);
    const log = dockerLog(fixture);
    const runs = log.split('\n').filter((line) => line.startsWith('RUN'));
    assert.equal(runs.length, 2);
    assert.match(runs[0], /<run> <\/scripts\/remote-health\.js>$/);
    assert.match(runs[1], /<run> <\/scripts\/smoke\.js>$/);
    assertCommonRemoteBoundary(log);
    assert.match(log, /BASE_URL=<https:\/\/auth-service:13443>/);
    assert.match(log, /REMOTE_MTLS=<true>/);
    const files = summaries(fixture);
    assert.equal(files.length, 1);
    assert.match(
      files[0],
      /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-verify\.json$/,
    );
    assert.equal(
      lstatSync(join(fixture.resultsDirectory, files[0])).isFile(),
      true,
    );
  });
});

test('verify initializes the real smoke configuration contract and retains a verify summary', () => {
  withFixture((fixture) => {
    const result = runRunner(
      fixture,
      ['verify', '--target-ip', '192.168.0.18'],
      { CHECK_SMOKE_CONFIG: 'true' },
    );

    assert.equal(result.status, 0, result.stderr);
    const files = summaries(fixture);
    assert.equal(files.length, 1);
    assert.match(
      files[0],
      /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-verify\.json$/,
    );
  });
});

test('probe defaults to 300 VUs with 60-second warmup and 180-second measurement', () => {
  withFixture((fixture) => {
    const result = runRunner(fixture, ['probe', '--target-ip', '192.168.0.18']);
    assert.equal(result.status, 0, result.stderr);
    const log = dockerLog(fixture);
    assertCommonRemoteBoundary(log);
    assert.match(log, /<run> <\/scripts\/journey\.js>$/m);
    assert.match(log, /VUS=<300>/);
    assert.match(log, /WARMUP_SECONDS=<60>/);
    assert.match(log, /MEASURE_SECONDS=<180>/);
    assert.match(log, /RUN_KIND=<probe>/);
    assert.match(log, /SUMMARY_PATH=<\/results\/[^>]+-probe\.json>/);
  });
});

test('soak defaults to 300 VUs for a bounded 1800-second measurement', () => {
  withFixture((fixture) => {
    const result = runRunner(fixture, ['soak', '--target-ip', '192.168.0.18']);
    assert.equal(result.status, 0, result.stderr);
    const log = dockerLog(fixture);
    assertCommonRemoteBoundary(log);
    assert.match(log, /<run> <\/scripts\/journey\.js>$/m);
    assert.match(log, /VUS=<300>/);
    assert.match(log, /WARMUP_SECONDS=<60>/);
    assert.match(log, /MEASURE_SECONDS=<1800>/);
    assert.match(log, /RUN_KIND=<soak>/);
    assert.match(log, /SOAK_SECONDS=<1800>/);
    assert.match(log, /SUMMARY_PATH=<\/results\/[^>]+-soak\.json>/);
  });
});

test('probe and soak accept only bounded positive integer overrides', () => {
  withFixture((fixture) => {
    const probe = runRunner(fixture, [
      'probe',
      '--target-ip',
      '10.20.30.40',
      '--vus',
      '24',
      '--warmup-seconds',
      '15',
      '--measure-seconds',
      '90',
    ]);
    assert.equal(probe.status, 0, probe.stderr);
    assert.match(dockerLog(fixture), /VUS=<24>/);
    assert.match(dockerLog(fixture), /WARMUP_SECONDS=<15>/);
    assert.match(dockerLog(fixture), /MEASURE_SECONDS=<90>/);
  });

  for (const [mode, option, value] of [
    ['probe', '--vus', '0'],
    ['probe', '--vus', '10001'],
    ['probe', '--warmup-seconds', '601'],
    ['probe', '--measure-seconds', '1801'],
    ['soak', '--soak-seconds', '1801'],
    ['soak', '--soak-seconds', '1.5'],
  ]) {
    withFixture((fixture) => {
      const result = runRunner(fixture, [
        mode,
        '--target-ip',
        '192.168.0.18',
        option,
        value,
      ]);
      assert.notEqual(result.status, 0);
      assert.equal(dockerLog(fixture), '');
    });
  }
});

test('runner rejects non-private or noncanonical target addresses before Docker', () => {
  for (const address of [
    '127.0.0.1',
    '0.0.0.0',
    '8.8.8.8',
    '192.168.001.18',
    '172.32.0.1',
    'not-an-ip',
  ]) {
    withFixture((fixture) => {
      const result = runRunner(fixture, ['probe', '--target-ip', address]);
      assert.notEqual(result.status, 0);
      assert.equal(dockerLog(fixture), '');
    });
  }
});

test('runner rejects duplicate target selection instead of using the last address', () => {
  withFixture((fixture) => {
    const result = runRunner(fixture, [
      'probe',
      '--target-ip',
      '192.168.0.18',
      '--target-ip',
      '10.20.30.40',
    ]);
    assert.notEqual(result.status, 0);
    assert.equal(dockerLog(fixture), '');
  });
});

test('runner requires macOS arm64 and an arm64 pinned k6 image', () => {
  for (const environment of [
    { FAKE_UNAME_S: 'Linux' },
    { FAKE_UNAME_M: 'x86_64' },
    { K6_ARCH: 'amd64' },
  ]) {
    withFixture((fixture) => {
      const result = runRunner(
        fixture,
        ['probe', '--target-ip', '192.168.0.18'],
        environment,
      );
      assert.notEqual(result.status, 0);
      assert.doesNotMatch(dockerLog(fixture), /RUN/);
    });
  }
});

test('runner rejects a noncanonical base URL and permissive secret files', () => {
  withFixture((fixture) => {
    writeFileSync(
      fixture.environmentPath,
      readFileSync(fixture.environmentPath, 'utf8').replace(
        'https://auth-service:13443',
        'http://auth-service:13443',
      ),
    );
    chmodSync(fixture.environmentPath, 0o600);
    const result = runRunner(fixture, ['probe', '--target-ip', '192.168.0.18']);
    assert.notEqual(result.status, 0);
    assert.equal(dockerLog(fixture), '');
  });

  for (const pathFor of [
    (fixture) => fixture.environmentPath,
    (fixture) => join(fixture.clientDirectory, 'client.key'),
  ]) {
    withFixture((fixture) => {
      chmodSync(pathFor(fixture), 0o640);
      const result = runRunner(fixture, [
        'probe',
        '--target-ip',
        '192.168.0.18',
      ]);
      assert.notEqual(result.status, 0);
      assert.equal(dockerLog(fixture), '');
    });
  }
});

test('runner rejects symlinked certificate and result paths', () => {
  withFixture((fixture) => {
    const realCertificate = join(fixture.root, 'real-client.crt');
    writeFileSync(realCertificate, 'fixture certificate\n');
    const certificate = join(fixture.clientDirectory, 'client.crt');
    rmSync(certificate);
    symlinkSync(realCertificate, certificate);
    const result = runRunner(fixture, ['probe', '--target-ip', '192.168.0.18']);
    assert.notEqual(result.status, 0);
    assert.equal(dockerLog(fixture), '');
  });

  withFixture((fixture) => {
    const externalResults = join(fixture.root, 'external-results');
    mkdirSync(externalResults);
    rmSync(fixture.resultsDirectory, { recursive: true });
    symlinkSync(externalResults, fixture.resultsDirectory);
    const result = runRunner(fixture, ['probe', '--target-ip', '192.168.0.18']);
    assert.notEqual(result.status, 0);
    assert.equal(dockerLog(fixture), '');
    assert.deepEqual(readdirSync(externalResults), []);
  });
});

test('runner rejects hidden files, directories, and symlinks in remote results', () => {
  for (const kind of ['file', 'directory', 'symlink']) {
    withFixture((fixture) => {
      const hiddenPath = join(fixture.resultsDirectory, `.unexpected-${kind}`);
      if (kind === 'file') {
        writeFileSync(hiddenPath, 'unexpected result artifact\n');
      } else if (kind === 'directory') {
        mkdirSync(hiddenPath);
      } else {
        const target = join(fixture.root, 'external-result-target');
        writeFileSync(target, 'keep\n');
        symlinkSync(target, hiddenPath);
      }

      const result = runRunner(fixture, [
        'probe',
        '--target-ip',
        '192.168.0.18',
      ]);
      assert.notEqual(result.status, 0);
      assert.equal(dockerLog(fixture), '');
      assert.equal(lstatSync(hiddenPath).isSymbolicLink(), kind === 'symlink');
    });
  }
});

test('runner diagnostics and Docker arguments never disclose runtime secrets', () => {
  withFixture((fixture) => {
    const result = runRunner(fixture, ['probe', '--target-ip', '192.168.0.18']);
    assert.equal(result.status, 0, result.stderr);
    const output = `${result.stdout}${result.stderr}${dockerLog(fixture)}`;
    for (const secret of [
      'fixture-admin-password',
      'fixture-load-user-password',
      'fixture-service-client-secret',
      'must-not-be-passed',
    ]) {
      assert.equal(output.includes(secret), false);
    }
  });
});
