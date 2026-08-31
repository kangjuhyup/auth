import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const workflowsDirectory = resolve(__dirname, '../../../.github/workflows');
const dockerDirectory = resolve(__dirname, '../../../deploy/docker');
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

  it('publishes release images for amd64 and arm64', () => {
    const workflow = readWorkflow('release.yml');

    expect(workflow).toMatch(/^ {10}platforms: linux\/amd64,linux\/arm64$/m);
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
