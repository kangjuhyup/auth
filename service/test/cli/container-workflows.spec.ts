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
});

function readWorkflow(filename: string): string {
  return readFileSync(resolve(workflowsDirectory, filename), 'utf8');
}
