import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const defaultSpecs = [
  'test/e2e/oidc.e2e-spec.ts',
  'test/e2e/user.e2e-spec.ts',
  'test/e2e/admin.e2e-spec.ts',
];

export function runE2eTests(args, spawn = spawnSync) {
  const specs = args.some((arg) => arg.endsWith('.e2e-spec.ts'))
    ? [args.find((arg) => arg.endsWith('.e2e-spec.ts'))]
    : defaultSpecs;
  const flags = args.filter((arg) => !arg.endsWith('.e2e-spec.ts'));

  for (const spec of specs) {
    const result = spawn(
      'yarn',
      [
        'exec',
        'jest',
        '--watchman=false',
        '--config',
        './test/jest-e2e.json',
        ...flags,
        spec,
      ],
      { stdio: 'inherit', env: process.env },
    );
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = runE2eTests(process.argv.slice(2));
}
