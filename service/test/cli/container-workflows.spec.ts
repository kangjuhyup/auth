import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const workflowsDirectory = resolve(__dirname, '../../../.github/workflows');
const dockerDirectory = resolve(__dirname, '../../../deploy/docker');
const repositoryRoot = resolve(__dirname, '../../..');
const containerVersionScript = resolve(
  repositoryRoot,
  'scripts/resolve-container-version.mjs',
);
const workflowFiles = readdirSync(workflowsDirectory)
  .filter((filename) => /\.ya?ml$/.test(filename))
  .sort();

describe('self-hosted workflow routing', () => {
  it.each(workflowFiles)(
    '%s routes every job to the macOS ARM64 self-hosted runner',
    (filename) => {
      const workflow = readWorkflow(filename);
      const jobs = readWorkflowJobs(workflow);

      expect(jobs.length).toBeGreaterThan(0);
      expect(
        jobs.map((job) => ({
          job: job.name,
          runsOn: job.source.match(/^ {4}runs-on:.*$/gm) ?? [],
        })),
      ).toEqual(
        jobs.map((job) => ({
          job: job.name,
          runsOn: ['    runs-on: [self-hosted, macOS, ARM64]'],
        })),
      );
      expect(workflow).not.toContain('ubuntu-latest');
    },
  );

  it('keeps untrusted fork code off the persistent PR runner', () => {
    const workflow = readWorkflow('pr-test-comment.yml');
    const unitTestsJob = readWorkflowJobs(workflow).find(
      (job) => job.name === 'unit-tests',
    );

    expect(workflow).toContain('  pull_request_target:');
    expect(workflow).not.toMatch(/^ {2}pull_request:$/m);
    expect(unitTestsJob?.source).toMatch(
      /^ {4}if: github\.event\.pull_request\.head\.repo\.full_name == github\.repository$/m,
    );
    const checkoutStep = readWorkflowStep(unitTestsJob?.source, 'Checkout');
    expect(checkoutStep).toMatch(
      /^ {10}repository: \${{ github\.event\.pull_request\.head\.repo\.full_name }}$/m,
    );
    expect(checkoutStep).toMatch(
      /^ {10}ref: \${{ github\.event\.pull_request\.head\.sha }}$/m,
    );
  });

  it('keeps the PR comment script compatible with macOS Bash 3.2', () => {
    const workflow = readWorkflow('pr-test-comment.yml');
    const unitTestsJob = readWorkflowJobs(workflow).find(
      (job) => job.name === 'unit-tests',
    );
    const composeStep = readWorkflowStep(
      unitTestsJob?.source,
      'Compose PR comment',
    );
    const script = readWorkflowRunScript(composeStep);
    const syntaxCheck = spawnSync('/bin/bash', ['-n'], {
      input: script,
      encoding: 'utf8',
    });

    expect(script).not.toContain('mapfile');
    expect(script).toContain('while IFS= read -r filepath; do');
    expect({ status: syntaxCheck.status, stderr: syntaxCheck.stderr }).toEqual({
      status: 0,
      stderr: '',
    });
  });
});

describe('container publication workflows', () => {
  it('publishes main images for amd64 and arm64', () => {
    const workflow = readWorkflow('container-main.yml');

    expect(workflow).toMatch(/^ {2}PLATFORMS: linux\/amd64,linux\/arm64$/m);
    expect(workflow).toMatch(/^ {10}platforms: \${{ env\.PLATFORMS }}$/m);
  });

  it('publishes main images with latest and package SemVer tags', () => {
    const workflow = readWorkflow('container-main.yml');

    expect(workflow).toContain(
      'IMAGE_VERSION=$(node scripts/resolve-container-version.mjs)',
    );
    expect(workflow).toContain('type=raw,value=latest');
    expect(workflow).toContain(
      'type=raw,value=${{ steps.version.outputs.image_version }}',
    );
    expect(workflow).not.toContain('type=raw,value=main');
    expect(workflow).not.toContain('type=sha,prefix=main-,format=short');
    expect(workflow).toContain('/auth-service:latest');
    expect(workflow).toContain('/auth-ui:latest');
  });

  it('publishes release images for amd64 and arm64', () => {
    const workflow = readWorkflow('release.yml');

    expect(workflow).toMatch(/^ {10}platforms: linux\/amd64,linux\/arm64$/m);
  });

  it('builds release images for the root Release Please tag', () => {
    const workflow = readWorkflow('release.yml');

    expect(workflow).toContain("- 'auth-v[0-9]+.[0-9]+.[0-9]+'");
    expect(workflow).toContain('VIN="${VIN#auth-v}"');
    expect(workflow).not.toContain("- 'v[0-9]+.[0-9]+.[0-9]+'");
  });

  it.each(['container-main.yml', 'release.yml'])(
    '%s keeps the required multi-platform build actions',
    (filename) => {
      const workflow = readWorkflow(filename);

      expect(workflow).toContain('uses: docker/setup-qemu-action@v3');
      expect(workflow).toContain('uses: docker/setup-buildx-action@v3');
      expect(workflow).toContain('uses: docker/build-push-action@v6');
    },
  );
});

describe('container version resolution', () => {
  it('resolves the linked package and release manifest version', () => {
    const result = spawnSync(process.execPath, [containerVersionScript], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });

    expect({ status: result.status, stderr: result.stderr }).toEqual({
      status: 0,
      stderr: '',
    });
    expect(result.stdout.trim()).toBe('v0.2.1');
  });

  it('rejects a workspace version that differs from the release manifest', () => {
    const workspace = mkdtempSync(resolve(tmpdir(), 'auth-version-test-'));

    try {
      writeVersionFixture(workspace, {
        root: '0.2.1',
        service: '0.2.0',
        ui: '0.2.1',
        interactionUi: '0.2.1',
      });
      const result = spawnSync(
        process.execPath,
        [containerVersionScript, workspace],
        { encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'service/package.json version 0.2.0 does not match 0.2.1',
      );
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe('release version contract', () => {
  it('creates one root release and updates workspace package versions', () => {
    const config = JSON.parse(
      readFileSync(
        resolve(repositoryRoot, 'release-please-config.json'),
        'utf8',
      ),
    ) as {
      plugins?: unknown[];
      packages: Record<
        string,
        { 'extra-files'?: Array<{ path?: string; jsonpath?: string }> }
      >;
    };
    const manifest = JSON.parse(
      readFileSync(
        resolve(repositoryRoot, '.release-please-manifest.json'),
        'utf8',
      ),
    ) as Record<string, string>;

    expect(Object.keys(config.packages)).toEqual(['.']);
    expect(config.plugins ?? []).toEqual([]);
    expect(config.packages['.']['extra-files']).toEqual([
      {
        type: 'json',
        path: 'service/package.json',
        jsonpath: '$.version',
      },
      { type: 'json', path: 'ui/package.json', jsonpath: '$.version' },
      {
        type: 'json',
        path: 'service/interaction-ui/package.json',
        jsonpath: '$.version',
      },
    ]);
    expect(manifest).toEqual({ '.': '0.2.1' });
  });
});

describe('UI production image build', () => {
  it('runs architecture-neutral UI compilation on the native build platform', () => {
    const dockerfile = readFileSync(
      resolve(dockerDirectory, 'Dockerfile.ui'),
      'utf8',
    );

    expect(dockerfile).toMatch(
      /^FROM --platform=\$BUILDPLATFORM node:24-alpine AS build$/m,
    );
    expect(dockerfile).toMatch(/^FROM nginx:1\.27-alpine AS runner$/m);
  });

  it('installs only the UI workspace dependencies before compiling the UI', () => {
    const dockerfile = readFileSync(
      resolve(dockerDirectory, 'Dockerfile.ui'),
      'utf8',
    );
    const dependencyStage = dockerfile.slice(
      0,
      dockerfile.indexOf('COPY ui ui'),
    );

    expect(dependencyStage).toMatch(/^RUN yarn workspaces focus @auth\/ui$/m);
    expect(dependencyStage).toContain(
      'ENV YARN_ENABLE_IMMUTABLE_INSTALLS=true',
    );
    expect(dependencyStage).not.toMatch(/^COPY (?:service|docs)\//m);
    expect(dependencyStage).not.toContain('RUN yarn install --immutable');
  });

  it('bounds Yarn fetch concurrency for memory-constrained multi-arch builders', () => {
    const dockerfile = readFileSync(
      resolve(dockerDirectory, 'Dockerfile.ui'),
      'utf8',
    );

    expect(dockerfile).toMatch(/^ENV YARN_NETWORK_CONCURRENCY=4$/m);
  });
});

function readWorkflow(filename: string): string {
  return readFileSync(resolve(workflowsDirectory, filename), 'utf8');
}

function writeVersionFixture(
  workspace: string,
  versions: Readonly<{
    root: string;
    service: string;
    ui: string;
    interactionUi: string;
  }>,
): void {
  const files = new Map([
    ['package.json', versions.root],
    ['service/package.json', versions.service],
    ['ui/package.json', versions.ui],
    ['service/interaction-ui/package.json', versions.interactionUi],
  ]);

  for (const [filename, version] of files) {
    const path = resolve(workspace, filename);
    const directory = path.slice(0, path.lastIndexOf('/'));
    mkdirSync(directory, { recursive: true });
    writeFileSync(path, JSON.stringify({ version }));
  }

  writeFileSync(
    resolve(workspace, '.release-please-manifest.json'),
    JSON.stringify({ '.': versions.root }),
  );
}

type WorkflowJob = Readonly<{ name: string; source: string }>;

function readWorkflowJobs(workflow: string): WorkflowJob[] {
  const jobsMarker = workflow.match(/^jobs:\s*$/m);
  if (jobsMarker?.index === undefined) return [];

  const jobsSource = workflow.slice(jobsMarker.index + jobsMarker[0].length);
  const jobPattern = /^ {2}([a-zA-Z0-9_-]+):\s*$/gm;
  const matches = [...jobsSource.matchAll(jobPattern)];

  return matches.map((match, index) => ({
    name: match[1],
    source: jobsSource.slice(
      match.index,
      matches[index + 1]?.index ?? jobsSource.length,
    ),
  }));
}

function readWorkflowStep(
  jobSource: string | undefined,
  stepName: string,
): string {
  if (!jobSource) return '';

  const marker = `      - name: ${stepName}`;
  const start = jobSource.indexOf(marker);
  if (start === -1) return '';

  const nextStep = jobSource.indexOf('\n      - name:', start + marker.length);
  return jobSource.slice(start, nextStep === -1 ? undefined : nextStep);
}

function readWorkflowRunScript(stepSource: string): string {
  const marker = '        run: |\n';
  const start = stepSource.indexOf(marker);
  if (start === -1) return '';

  return stepSource
    .slice(start + marker.length)
    .split('\n')
    .map((line) => line.replace(/^ {10}/, ''))
    .join('\n');
}
