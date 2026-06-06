import {
  GLOBAL_MODULE_METADATA,
  GUARDS_METADATA,
  MODULE_METADATA,
} from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { MikroORM } from '@mikro-orm/core';
import { ApplicationModule } from '@application/application.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { NotificationModule } from '@infrastructure/notification/notification.module';
import { OidcProviderModule } from '@infrastructure/oidc-provider/oidc-provider.module';
import { REDIS, RedisModule } from '@infrastructure/redis/redis.module';
import { SmtpModule } from '@infrastructure/smtp/smtp.module';
import { PresentationModule } from '@presentation/presentation.module';
import { AppModule } from '../../src/app.module';

type ClassToken = abstract new (...args: never[]) => unknown;

type ModuleCase = Readonly<{
  name: string;
  module: ClassToken;
}>;

type ProviderDefinition =
  | ClassToken
  | {
      provide?: unknown;
      inject?: readonly unknown[];
    };

type ModuleImport =
  | ClassToken
  | {
      module?: ClassToken;
      forwardRef?: () => ClassToken;
    };

const projectModules: ModuleCase[] = [
  { name: 'AppModule', module: AppModule },
  { name: 'PresentationModule', module: PresentationModule },
  { name: 'ApplicationModule', module: ApplicationModule },
  { name: 'InfrastructureModule', module: InfrastructureModule },
  { name: 'OidcProviderModule', module: OidcProviderModule },
  { name: 'NotificationModule', module: NotificationModule },
  { name: 'RedisModule', module: RedisModule },
  { name: 'SmtpModule', module: SmtpModule },
];

const projectModuleTokens = new Set(projectModules.map(({ module }) => module));
const externalGlobalTokens = new Set<unknown>([ConfigService, MikroORM, REDIS]);

function isClassToken(token: unknown): token is ClassToken {
  return typeof token === 'function';
}

function isProjectModuleToken(token: unknown): token is ClassToken {
  return isClassToken(token) && projectModuleTokens.has(token);
}

function providerToken(provider: ProviderDefinition): unknown {
  if (isClassToken(provider)) {
    return provider;
  }

  return provider.provide;
}

function providerInjectTokens(provider: ProviderDefinition): unknown[] {
  if (isClassToken(provider)) {
    return [];
  }

  return (provider.inject ?? []).map(normalizeInjectedToken);
}

function normalizeInjectedToken(token: unknown): unknown {
  if (typeof token === 'object' && token !== null && 'token' in token) {
    return (token as { token: unknown }).token;
  }

  return token;
}

function importedModuleToken(moduleImport: ModuleImport): unknown {
  if (isClassToken(moduleImport)) {
    return moduleImport;
  }

  if (moduleImport.forwardRef) {
    return moduleImport.forwardRef();
  }

  return moduleImport.module;
}

function moduleMetadata<T>(module: ClassToken, key: string): T[] {
  return Reflect.getMetadata(key, module) ?? [];
}

function providerTokens(module: ClassToken): Set<unknown> {
  return new Set(
    moduleMetadata<ProviderDefinition>(module, MODULE_METADATA.PROVIDERS).map(
      providerToken,
    ),
  );
}

function importedModuleTokens(module: ClassToken): Set<unknown> {
  return new Set(
    moduleMetadata<ModuleImport>(module, MODULE_METADATA.IMPORTS).map(
      importedModuleToken,
    ),
  );
}

function rawExportTokens(module: ClassToken): unknown[] {
  return moduleMetadata<unknown>(module, MODULE_METADATA.EXPORTS);
}

function exportToken(token: unknown): unknown {
  if (isProviderDefinition(token)) {
    return providerToken(token);
  }

  return token;
}

function isProviderDefinition(token: unknown): token is ProviderDefinition {
  return (
    isClassToken(token) ||
    (typeof token === 'object' && token !== null && 'provide' in token)
  );
}

function exportedInjectionTokens(
  module: ClassToken,
  seen = new Set<unknown>(),
): Set<unknown> {
  if (seen.has(module)) {
    return new Set();
  }
  seen.add(module);

  const tokens = new Set<unknown>();
  for (const rawExportToken of rawExportTokens(module)) {
    const token = exportToken(rawExportToken);
    if (isProjectModuleToken(token)) {
      for (const nestedToken of exportedInjectionTokens(token, seen)) {
        tokens.add(nestedToken);
      }
      continue;
    }

    tokens.add(token);
  }

  return tokens;
}

function globalInjectionTokens(): Set<unknown> {
  const tokens = new Set(externalGlobalTokens);
  for (const { module } of projectModules) {
    if (!Reflect.getMetadata(GLOBAL_MODULE_METADATA, module)) {
      continue;
    }

    for (const token of exportedInjectionTokens(module)) {
      tokens.add(token);
    }
  }

  return tokens;
}

function availableInjectionTokens(module: ClassToken): Set<unknown> {
  const tokens = new Set<unknown>([
    ...providerTokens(module),
    ...globalInjectionTokens(),
  ]);

  for (const importedToken of importedModuleTokens(module)) {
    if (!isProjectModuleToken(importedToken)) {
      continue;
    }

    for (const token of exportedInjectionTokens(importedToken)) {
      tokens.add(token);
    }
  }

  return tokens;
}

function exportableTokens(module: ClassToken): Set<unknown> {
  return new Set([...providerTokens(module), ...importedModuleTokens(module)]);
}

function classGuardTokens(controller: ClassToken): unknown[] {
  const guards = [...(Reflect.getMetadata(GUARDS_METADATA, controller) ?? [])];
  const prototype = controller.prototype as Record<string, unknown>;
  for (const propertyName of Object.getOwnPropertyNames(prototype)) {
    if (propertyName === 'constructor') {
      continue;
    }

    const handler = prototype[propertyName];
    if (typeof handler !== 'function') {
      continue;
    }

    guards.push(...(Reflect.getMetadata(GUARDS_METADATA, handler) ?? []));
  }

  return guards.filter((guard) => typeof guard === 'function');
}

function describeToken(token: unknown): string {
  if (isClassToken(token)) {
    return token.name;
  }

  if (typeof token === 'symbol') {
    return token.description ?? token.toString();
  }

  return String(token);
}

describe('architecture: Nest module exports', () => {
  it.each(projectModules)(
    '$name은 자기 provider 또는 imported module만 export한다',
    ({ module }) => {
      const invalidExports = rawExportTokens(module).filter(
        (exportedToken) =>
          !exportableTokens(module).has(exportToken(exportedToken)),
      );

      expect(invalidExports.map(describeToken)).toEqual([]);
    },
  );
});

describe('architecture: Nest module dependency injection', () => {
  it.each(projectModules)(
    '$name factory provider의 inject token은 module scope에서 해결 가능하다',
    ({ module }) => {
      const availableTokens = availableInjectionTokens(module);
      const providers = moduleMetadata<ProviderDefinition>(
        module,
        MODULE_METADATA.PROVIDERS,
      );

      const missingTokens = providers.flatMap((provider) =>
        providerInjectTokens(provider)
          .filter((token) => !availableTokens.has(token))
          .map(
            (token) =>
              `${describeToken(providerToken(provider))} -> ${describeToken(token)}`,
          ),
      );

      expect(missingTokens).toEqual([]);
    },
  );

  it.each(projectModules)(
    '$name controller에서 사용하는 class guard는 module scope에 등록되어 있다',
    ({ module }) => {
      const availableTokens = availableInjectionTokens(module);
      const controllers = moduleMetadata<ClassToken>(
        module,
        MODULE_METADATA.CONTROLLERS,
      );

      const missingGuards = controllers.flatMap((controller) =>
        classGuardTokens(controller)
          .filter((guard) => !availableTokens.has(guard))
          .map(
            (guard) =>
              `${describeToken(controller)} -> ${describeToken(guard)}`,
          ),
      );

      expect(missingGuards).toEqual([]);
    },
  );
});
