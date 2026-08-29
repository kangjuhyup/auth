import { AdminBootstrapPort } from '@application/process-managers/ports/admin-bootstrap.port';
import {
  runBootstrapCommand,
  type RunBootstrapCommandOptions,
} from './bootstrap-runtime';

export interface AdminBootstrapCliDependencies {
  readonly run: (options: RunBootstrapCommandOptions) => Promise<number>;
  readonly readEnv: (key: string) => string | undefined;
}

function withoutTrailingSlash(value: string): string {
  const normalized = value.replace(/\/+$/, '');
  return normalized || '/';
}

export async function runAdminBootstrap(
  dependencies: AdminBootstrapCliDependencies = {
    run: runBootstrapCommand,
    readEnv: (key) => process.env[key],
  },
): Promise<number> {
  const username = dependencies.readEnv('ADMIN_USERNAME')?.trim() || 'admin';
  const password = dependencies.readEnv('ADMIN_PASSWORD');
  const adminUiUrl = withoutTrailingSlash(
    dependencies.readEnv('ADMIN_UI_URL')?.trim() || 'http://localhost:5173',
  );

  return dependencies.run({
    failureMessage: 'Administrator bootstrap failed',
    execute: async (appContext) => {
      const bootstrap = appContext.get<AdminBootstrapPort>(AdminBootstrapPort);
      await bootstrap.bootstrap({ username, password, adminUiUrl });
    },
  });
}

if (require.main === module) {
  void runAdminBootstrap().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
