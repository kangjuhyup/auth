import { MikroORM, RequestContext } from '@mikro-orm/core';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';

export interface BootstrapApplicationContext {
  get<T>(token: unknown): T;
  close(): Promise<void>;
}

export interface RunBootstrapCommandOptions {
  readonly execute: (appContext: BootstrapApplicationContext) => Promise<void>;
  readonly failureMessage: string;
  readonly createContext?: () => Promise<BootstrapApplicationContext>;
  readonly requestContext?: (
    entityManager: MikroORM['em'],
    work: () => Promise<void>,
  ) => Promise<void>;
  readonly error?: (message: string) => void;
}

export async function runBootstrapCommand(
  options: RunBootstrapCommandOptions,
): Promise<number> {
  const createContext =
    options.createContext ??
    (async () =>
      NestFactory.createApplicationContext(AppModule, {
        abortOnError: false,
        logger: false,
      }));
  const requestContext =
    options.requestContext ??
    ((entityManager: MikroORM['em'], work: () => Promise<void>) =>
      RequestContext.create(entityManager, work));
  const writeError = options.error ?? console.error;

  let appContext: BootstrapApplicationContext | undefined;
  let failed = false;

  try {
    const createdContext = await createContext();
    appContext = createdContext;
    const orm = createdContext.get<MikroORM>(MikroORM);
    await requestContext(orm.em, () => options.execute(createdContext));
  } catch {
    failed = true;
  } finally {
    if (appContext) {
      try {
        await appContext.close();
      } catch {
        failed = true;
      }
    }
  }

  if (failed) {
    writeError(options.failureMessage);
    return 1;
  }
  return 0;
}
