import { canonicalizeAdminUiUrl } from '@application/process-managers/admin-bootstrap-url';
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

function resolveAdminUiUrl(readEnv: (key: string) => string | undefined): {
  canonical: string;
  legacyMigrationRaw: string;
} {
  const configured = readEnv('ADMIN_UI_URL')?.trim();
  const production = readEnv('NODE_ENV')?.trim().toLowerCase() === 'production';
  if (!configured && production) {
    throw new AdminUiUrlConfigurationError();
  }

  const legacyMigrationRaw = configured || 'http://localhost:5173';
  const canonical = canonicalizeAdminUiUrl(legacyMigrationRaw);
  if (!canonical) {
    throw new AdminUiUrlConfigurationError();
  }

  return { canonical, legacyMigrationRaw };
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
      await bootstrap.bootstrap({
        username,
        password,
        adminUiUrl: adminUiUrl.canonical,
        legacyMigrationAdminUiUrl: adminUiUrl.legacyMigrationRaw,
      });
    },
  });
}

if (require.main === module) {
  void runBootstrapMain({
    run: runAdminBootstrap,
    exit: (code) => process.exit(code),
  });
}
