import 'reflect-metadata';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

export async function bootstrapWorker(): Promise<void> {
  const { WorkerModule } = await import('./worker.module');
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    abortOnError: false,
    // Avoid Nest logging raw initialization errors containing DB credentials.
    logger: false,
  });
  app.useLogger(new ConsoleLogger({ logLevels: ['log', 'warn', 'error'] }));
  app.enableShutdownHooks(['SIGTERM', 'SIGINT']);
  new Logger('OidcCleanupWorker').log('OIDC cleanup worker started');
}

if (require.main === module) {
  void bootstrapWorker().catch(() => {
    console.error('OIDC cleanup worker startup failed');
    process.exit(1);
  });
}
