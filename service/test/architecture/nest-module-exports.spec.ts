import { MODULE_METADATA } from '@nestjs/common/constants';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

type ClassToken = abstract new (...args: never[]) => unknown;

type ProviderDefinition =
  | ClassToken
  | {
      provide?: unknown;
    };

type ModuleImport =
  | ClassToken
  | {
      module?: ClassToken;
    };

function providerToken(provider: ProviderDefinition): unknown {
  if (typeof provider === 'function') {
    return provider;
  }

  return provider.provide;
}

function importedModuleToken(moduleImport: ModuleImport): unknown {
  if (typeof moduleImport === 'function') {
    return moduleImport;
  }

  return moduleImport.module;
}

function describeToken(token: unknown): string {
  if (typeof token === 'function') {
    return token.name;
  }

  if (typeof token === 'symbol') {
    return token.description ?? token.toString();
  }

  return String(token);
}

describe('architecture: Nest module exports', () => {
  it('InfrastructureModule은 자기 provider 또는 imported module만 export한다', () => {
    const providers = (
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, InfrastructureModule) ?? []
    ).map(providerToken);
    const imports = (
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, InfrastructureModule) ?? []
    ).map(importedModuleToken);
    const exports =
      Reflect.getMetadata(MODULE_METADATA.EXPORTS, InfrastructureModule) ?? [];

    const exportableTokens = new Set([...providers, ...imports]);
    const invalidExports = exports.filter(
      (exportedToken: unknown) => !exportableTokens.has(exportedToken),
    );

    expect(invalidExports.map(describeToken)).toEqual([]);
  });
});
