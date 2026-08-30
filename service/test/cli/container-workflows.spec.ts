import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workflowsDirectory = resolve(__dirname, '../../../.github/workflows');
const dockerDirectory = resolve(__dirname, '../../../deploy/docker');

describe('container publication workflows', () => {
  it('publishes main images for amd64 and arm64', () => {
    const workflow = readWorkflow('container-main.yml');

    expect(workflow).toMatch(
      /^  PLATFORMS: linux\/amd64,linux\/arm64$/m,
    );
    expect(workflow).toMatch(/^          platforms: \${{ env\.PLATFORMS }}$/m);
  });

  it('publishes release images for amd64 and arm64', () => {
    const workflow = readWorkflow('release.yml');

    expect(workflow).toMatch(
      /^          platforms: linux\/amd64,linux\/arm64$/m,
    );
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
    const dependencyStage = dockerfile.slice(0, dockerfile.indexOf('COPY ui ui'));

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
