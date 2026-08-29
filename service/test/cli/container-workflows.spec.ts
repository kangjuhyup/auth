import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workflowsDirectory = resolve(__dirname, '../../../.github/workflows');

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

function readWorkflow(filename: string): string {
  return readFileSync(resolve(workflowsDirectory, filename), 'utf8');
}
