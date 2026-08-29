import { AdminBootstrapPort } from '@application/process-managers/ports/admin-bootstrap.port';
import {
  runBootstrapCommand,
  type RunBootstrapCommandOptions,
} from './bootstrap-runtime';
import { runBootstrapMain } from './bootstrap-main';

export interface AdminBootstrapCliDependencies {
  readonly run: (options: RunBootstrapCommandOptions) => Promise<number>;
  readonly readEnv: (key: string) => string | undefined;
}

export class AdminUiUrlConfigurationError extends Error {
  readonly code = 'ADMIN_UI_URL_INVALID';

  constructor() {
    super('ADMIN_UI_URL_INVALID');
    this.name = 'AdminUiUrlConfigurationError';
  }
}

function resolveAdminUiUrl(
  readEnv: (key: string) => string | undefined,
): string {
  const configured = readEnv('ADMIN_UI_URL')?.trim();
  const production = readEnv('NODE_ENV')?.trim().toLowerCase() === 'production';
  if (!configured && production) {
    throw new AdminUiUrlConfigurationError();
  }

  const value = configured || 'http://localhost:5173';
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new AdminUiUrlConfigurationError();
  }

  const localHost = new Set(['localhost', '127.0.0.1', '[::1]']).has(
    parsed.hostname,
  );
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    (parsed.protocol === 'http:' && !localHost) ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    throw new AdminUiUrlConfigurationError();
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${normalizedPath}`;
}

export async function runAdminBootstrap(
  dependencies: AdminBootstrapCliDependencies = {
    run: runBootstrapCommand,
    readEnv: (key) => process.env[key],
  },
): Promise<number> {
  const username = dependencies.readEnv('ADMIN_USERNAME')?.trim() || 'admin';
  const password = dependencies.readEnv('ADMIN_PASSWORD');

  return dependencies.run({
    failureMessage: 'Administrator bootstrap failed',
    execute: async (appContext) => {
      const adminUiUrl = resolveAdminUiUrl(dependencies.readEnv);
      const bootstrap = appContext.get<AdminBootstrapPort>(AdminBootstrapPort);
      await bootstrap.bootstrap({ username, password, adminUiUrl });
    },
  });
}

if (require.main === module) {
  void runBootstrapMain({
    run: runAdminBootstrap,
    exit: (code) => process.exit(code),
  });
}
