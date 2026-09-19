import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const workspaceRoot = resolve(process.argv[2] ?? process.cwd());
const packageFiles = [
  'package.json',
  'service/package.json',
  'ui/package.json',
  'service/interaction-ui/package.json',
];
const manifestFile = '.release-please-manifest.json';

try {
  const rootVersion = readVersion(packageFiles[0]);
  if (!/^\d+\.\d+\.\d+$/.test(rootVersion)) {
    throw new Error(
      `package.json version ${rootVersion} must be a stable SemVer value`,
    );
  }

  for (const filename of packageFiles.slice(1)) {
    const version = readVersion(filename);
    assertMatchingVersion(filename, version, rootVersion);
  }

  const manifest = readJson(manifestFile);
  const releaseVersion = manifest['.'];
  if (typeof releaseVersion !== 'string') {
    throw new Error(`${manifestFile} is missing version for .`);
  }
  assertMatchingVersion(`${manifestFile}:.`, releaseVersion, rootVersion);

  process.stdout.write(`v${rootVersion}\n`);
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Container version resolution failed'}\n`,
  );
  process.exitCode = 1;
}

function readVersion(filename) {
  const version = readJson(filename).version;
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(`${filename} does not contain a version`);
  }
  return version;
}

function readJson(filename) {
  return JSON.parse(readFileSync(resolve(workspaceRoot, filename), 'utf8'));
}

function assertMatchingVersion(filename, version, expected) {
  if (version !== expected) {
    throw new Error(
      `${filename} version ${version} does not match ${expected}`,
    );
  }
}
