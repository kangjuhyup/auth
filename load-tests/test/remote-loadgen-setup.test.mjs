import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = new URL('../..', import.meta.url);
const scriptPath = fileURLToPath(
  new URL('../../scripts/setup-remote-loadgen.sh', import.meta.url),
);

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
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'remote-loadgen-'));
  const remote = join(root, 'remote.git');
  const source = join(root, 'source');
  const fakeBin = join(root, 'bin');
  const dockerLog = join(root, 'docker.log');

  run('git', ['init', '--bare', '--initial-branch=main', remote]);
  run('git', ['clone', remote, source]);
  run('git', ['config', 'user.email', 'load-test@example.invalid'], {
    cwd: source,
  });
  run('git', ['config', 'user.name', 'Load test'], { cwd: source });
  writeFileSync(join(source, 'version.txt'), 'v1\n');
  writeFileSync(join(source, '.gitignore'), '/load-tests/results/\n');
  mkdirSync(join(source, 'load-tests', 'k6'), { recursive: true });
  writeFileSync(join(source, 'load-tests', 'k6', 'journey.js'), '// fixture\n');
  writeFileSync(join(source, 'load-tests', 'run-capacity.mjs'), '// fixture\n');
  run('git', ['add', '.gitignore', 'version.txt', 'load-tests'], {
    cwd: source,
  });
  run('git', ['commit', '-m', 'initial'], { cwd: source });
  run('git', ['push', 'origin', 'main'], { cwd: source });

  mkdirSync(fakeBin);
  writeFileSync(
    join(fakeBin, 'uname'),
    `#!/bin/sh
case "$1" in
  -s) printf '%s\\n' "\${FAKE_UNAME_S:-Darwin}" ;;
  -m) printf '%s\\n' "\${FAKE_UNAME_M:-arm64}" ;;
  *) exit 1 ;;
esac
`,
  );
  writeFileSync(
    join(fakeBin, 'docker'),
    `#!/bin/sh
printf '%s\\n' "$*" >> "$DOCKER_LOG"
case "$1" in
  --version) printf '%s\\n' 'Docker version 28.0.0' ;;
  compose)
    [ "$2" = version ] || exit 1
    if [ "$3" = --short ]; then
      printf '%s\\n' "\${DOCKER_COMPOSE_VERSION:-v2.30.0}"
    else
      printf '%s\\n' 'Docker Compose version v2.30.0'
    fi
    ;;
  info)
    [ "\${DOCKER_DAEMON:-running}" = running ] || exit 1
    printf '%s\\n' 'Server: Docker Engine'
    ;;
  pull) [ "\${DOCKER_PULL:-ok}" = ok ] || exit 1 ;;
  image)
    [ "$2" = inspect ] || exit 1
    printf '%s\\n' "\${K6_ARCH:-arm64}"
    ;;
  run)
    [ "\${DOCKER_RUN:-ok}" = ok ] || exit 1
    printf '%s\\n' 'k6 v2.2.0'
    ;;
  *) exit 1 ;;
esac
`,
  );
  chmodSync(join(fakeBin, 'uname'), 0o755);
  chmodSync(join(fakeBin, 'docker'), 0o755);

  return {
    root,
    remote,
    source,
    dockerLog,
    checkout: join(root, 'checkout'),
    env: {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH}`,
      DOCKER_LOG: dockerLog,
    },
  };
}

function runSetup(fixture, args, environment = {}) {
  return spawnSync('bash', [scriptPath, ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { ...fixture.env, ...environment },
  });
}

function setupArgs(fixture) {
  return [
    '--repo',
    fixture.remote,
    '--branch',
    'main',
    '--directory',
    fixture.checkout,
  ];
}

function branchArgs(fixture, branch) {
  return [
    '--repo',
    fixture.remote,
    '--branch',
    branch,
    '--directory',
    fixture.checkout,
  ];
}

function addResultSymlink(fixture, kind) {
  const externalDirectory = join(fixture.root, `external-${kind}`);
  const resultsDirectory = join(fixture.source, 'load-tests', 'results');
  mkdirSync(externalDirectory);
  chmodSync(externalDirectory, 0o755);

  if (kind === 'parent') {
    symlinkSync(externalDirectory, resultsDirectory);
    run('git', ['add', '--force', 'load-tests/results'], {
      cwd: fixture.source,
    });
  } else {
    mkdirSync(resultsDirectory);
    symlinkSync(externalDirectory, join(resultsDirectory, 'remote'));
    run('git', ['add', '--force', 'load-tests/results/remote'], {
      cwd: fixture.source,
    });
  }
  run('git', ['commit', '-m', `add ${kind} result link`], {
    cwd: fixture.source,
  });
  run('git', ['push', 'origin', 'main'], { cwd: fixture.source });
  return externalDirectory;
}

function withFixture(callback) {
  const fixture = createFixture();
  try {
    callback(fixture);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
}

test('fresh setup clones the selected branch and validates pinned arm64 k6', () => {
  withFixture((fixture) => {
    const result = runSetup(fixture, setupArgs(fixture));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      readFileSync(join(fixture.checkout, 'version.txt'), 'utf8'),
      'v1\n',
    );
    assert.match(
      readFileSync(fixture.dockerLog, 'utf8'),
      /pull grafana\/k6:2\.2\.0/,
    );
    assert.equal(
      statSync(join(fixture.checkout, 'load-tests/results/remote')).mode &
        0o777,
      0o700,
    );
  });
});

test('dirty existing checkout is rejected without changing user files', () => {
  withFixture((fixture) => {
    assert.equal(runSetup(fixture, setupArgs(fixture)).status, 0);
    writeFileSync(join(fixture.checkout, 'local-change.txt'), 'keep\n');
    const result = runSetup(fixture, setupArgs(fixture));
    assert.notEqual(result.status, 0);
    assert.equal(
      readFileSync(join(fixture.checkout, 'local-change.txt'), 'utf8'),
      'keep\n',
    );
  });
});

test('prints help and rejects missing or unsafe destinations', () => {
  withFixture((fixture) => {
    const help = runSetup(fixture, ['--help']);
    assert.equal(help.status, 0);
    assert.match(help.stdout, /Usage: setup-remote-loadgen\.sh/);
    assert.notEqual(runSetup(fixture, ['--repo', fixture.remote]).status, 0);
    assert.notEqual(runSetup(fixture, ['--not-an-option']).status, 0);
    assert.notEqual(
      runSetup(fixture, ['--repo', fixture.remote, '--directory', '/']).status,
      0,
    );
    assert.notEqual(
      runSetup(fixture, [
        '--repo',
        fixture.remote,
        '--directory',
        process.env.HOME,
      ]).status,
      0,
    );
    const homeLink = join(fixture.root, 'home-link');
    symlinkSync(process.env.HOME, homeLink);
    assert.notEqual(
      runSetup(fixture, ['--repo', fixture.remote, '--directory', homeLink])
        .status,
      0,
    );
  });
});

test('rejects an existing checkout with a mismatched origin', () => {
  withFixture((fixture) => {
    assert.equal(runSetup(fixture, setupArgs(fixture)).status, 0);
    run(
      'git',
      ['remote', 'set-url', 'origin', join(fixture.root, 'other.git')],
      {
        cwd: fixture.checkout,
      },
    );
    assert.notEqual(runSetup(fixture, setupArgs(fixture)).status, 0);
  });
});

test('rejects unsupported host architecture, Compose v1, and stopped Docker', () => {
  withFixture((fixture) => {
    assert.notEqual(
      runSetup(fixture, setupArgs(fixture), { FAKE_UNAME_S: 'Linux' }).status,
      0,
    );
    assert.notEqual(
      runSetup(fixture, setupArgs(fixture), { FAKE_UNAME_M: 'x86_64' }).status,
      0,
    );
    assert.notEqual(
      runSetup(fixture, setupArgs(fixture), {
        DOCKER_COMPOSE_VERSION: 'v1.29.2',
      }).status,
      0,
    );
    assert.notEqual(
      runSetup(fixture, setupArgs(fixture), { DOCKER_DAEMON: 'stopped' })
        .status,
      0,
    );
  });
});

test('rejects result-path symlinks without changing external directories', () => {
  for (const kind of ['parent', 'final']) {
    withFixture((fixture) => {
      const externalDirectory = addResultSymlink(fixture, kind);
      const beforeMode = statSync(externalDirectory).mode & 0o777;
      const result = runSetup(fixture, setupArgs(fixture));
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /symbolic link/);
      assert.equal(statSync(externalDirectory).mode & 0o777, beforeMode);
    });
  }
});

test('rejects a repository subdirectory before Git update operations', () => {
  withFixture((fixture) => {
    assert.equal(runSetup(fixture, setupArgs(fixture)).status, 0);
    const result = runSetup(
      fixture,
      branchArgs(fixture, 'main').map((argument) =>
        argument === fixture.checkout
          ? join(fixture.checkout, 'load-tests')
          : argument,
      ),
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Git checkout root/);
  });
});

test('updates a main-only clone to a later remote branch', () => {
  withFixture((fixture) => {
    assert.equal(runSetup(fixture, setupArgs(fixture)).status, 0);
    run('git', ['checkout', '-b', 'release'], { cwd: fixture.source });
    writeFileSync(join(fixture.source, 'version.txt'), 'release\n');
    run('git', ['add', 'version.txt'], { cwd: fixture.source });
    run('git', ['commit', '-m', 'release'], { cwd: fixture.source });
    run('git', ['push', 'origin', 'release'], { cwd: fixture.source });
    const result = runSetup(fixture, branchArgs(fixture, 'release'));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      readFileSync(join(fixture.checkout, 'version.txt'), 'utf8'),
      'release\n',
    );
  });
});

test('rejects a k6 image that is not arm64', () => {
  withFixture((fixture) => {
    const result = runSetup(fixture, setupArgs(fixture), { K6_ARCH: 'amd64' });
    assert.notEqual(result.status, 0);
  });
});

test('fast-forwards a clean existing checkout to the requested branch', () => {
  withFixture((fixture) => {
    assert.equal(runSetup(fixture, setupArgs(fixture)).status, 0);
    writeFileSync(join(fixture.source, 'version.txt'), 'v2\n');
    run('git', ['add', 'version.txt'], { cwd: fixture.source });
    run('git', ['commit', '-m', 'update'], { cwd: fixture.source });
    run('git', ['push', 'origin', 'main'], { cwd: fixture.source });
    const result = runSetup(fixture, setupArgs(fixture));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      readFileSync(join(fixture.checkout, 'version.txt'), 'utf8'),
      'v2\n',
    );
  });
});

test('reruns safely with an unchanged clean checkout', () => {
  withFixture((fixture) => {
    assert.equal(runSetup(fixture, setupArgs(fixture)).status, 0);
    const result = runSetup(fixture, setupArgs(fixture));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      statSync(join(fixture.checkout, 'load-tests/results/remote')).mode &
        0o777,
      0o700,
    );
  });
});
