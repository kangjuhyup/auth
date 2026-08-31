import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repositoryRoot = resolve(__dirname, '../../../..');

describe('E2E infrastructure scripts', () => {
  it('down script uses the dedicated project and never removes compose orphans', () => {
    const fakeBin = mkdtempSync(join(tmpdir(), 'auth-fake-docker-'));
    const argumentsFile = join(fakeBin, 'docker-arguments');
    const docker = join(fakeBin, 'docker');
    writeFileSync(
      docker,
      '#!/bin/sh\nprintf "%s\\n" "$@" > "$FAKE_DOCKER_ARGUMENTS"\n',
    );
    chmodSync(docker, 0o755);

    execFileSync('corepack', ['yarn', 'service:test:e2e:infra:down'], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH}`,
        FAKE_DOCKER_ARGUMENTS: argumentsFile,
      },
      stdio: 'pipe',
    });

    expect(readFileSync(argumentsFile, 'utf8').trim().split('\n')).toEqual([
      'compose',
      '--project-name',
      'auth-e2e',
      '-f',
      'docker-compose.e2e.yml',
      'down',
      '-v',
    ]);
  });
});
