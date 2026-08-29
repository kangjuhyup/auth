import { spawnSync } from 'node:child_process';

const imageTag = process.env.AUTH_SERVICE_IMAGE_TEST_TAG;
const describeWithImage = imageTag ? describe : describe.skip;

describeWithImage('service production image content', () => {
  it('contains the built interaction UI at the path served by Nest', () => {
    const result = spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '--entrypoint',
        'node',
        imageTag!,
        '-e',
        [
          "const { readFileSync } = require('node:fs');",
          "const html = readFileSync('/app/service/interaction-ui/dist/index.html', 'utf8');",
          'if (!html.includes(\'<div id="root"></div>\')) process.exit(2);',
          "process.stdout.write('interaction-ui-ready');",
        ].join(''),
      ],
      { encoding: 'utf8' },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('interaction-ui-ready');
  });
});
