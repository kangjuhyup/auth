import { AcmeBootstrapPort } from '@application/process-managers/ports/acme-bootstrap.port';
import {
  runBootstrapCommand,
  type RunBootstrapCommandOptions,
} from './bootstrap-runtime';

export interface AcmeBootstrapCliDependencies {
  readonly run: (options: RunBootstrapCommandOptions) => Promise<number>;
}

export async function runAcmeBootstrap(
  dependencies: AcmeBootstrapCliDependencies = {
    run: runBootstrapCommand,
  },
): Promise<number> {
  return dependencies.run({
    failureMessage: 'Acme bootstrap failed',
    execute: async (appContext) => {
      const bootstrap = appContext.get<AcmeBootstrapPort>(AcmeBootstrapPort);
      await bootstrap.bootstrap();
    },
  });
}

if (require.main === module) {
  void runAcmeBootstrap().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
