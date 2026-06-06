import { Injectable } from '@nestjs/common';
import { ScopeRegistryPort } from '@application/ports/scope-registry.port';
import type {
  ScopeDefinition,
  ScopeValidationIssue,
  ScopeValidationParams,
} from '@application/ports/scope-registry.port';
import { BUILT_IN_OIDC_SCOPES, isValidScopeToken } from '@domain/models/scope';
import { ScopeRepository } from '@domain/repositories';

const BUILT_IN_SCOPE_DEFINITIONS: ScopeDefinition[] = BUILT_IN_OIDC_SCOPES.map(
  (scope) => ({
    scope,
    displayName: scope,
    claimKeys: defaultClaimKeysFor(scope),
    builtIn: true,
    enabled: true,
  }),
);

@Injectable()
export class OidcScopeRegistryAdapter extends ScopeRegistryPort {
  constructor(private readonly scopeRepository: ScopeRepository) {
    super();
  }

  async listSupportedScopes(tenantId?: string): Promise<string[]> {
    return (await this.getDefinitions(tenantId))
      .filter((scope) => scope.enabled)
      .map((scope) => scope.scope);
  }

  async listDefinitions(tenantId?: string): Promise<ScopeDefinition[]> {
    return (await this.getDefinitions(tenantId)).map((scope) => ({ ...scope }));
  }

  async validateClientScopes(
    params: ScopeValidationParams,
  ): Promise<ScopeValidationIssue[]> {
    const requestedScopes = params.scopes;
    if (requestedScopes.length === 0) {
      return [{ scope: '', reason: 'empty' }];
    }

    const definitions = await this.getDefinitions(params.tenantId);
    const byScope = new Map(
      definitions.map((definition) => [definition.scope, definition]),
    );
    const issues: ScopeValidationIssue[] = [];

    for (const scope of requestedScopes) {
      if (!isValidScopeToken(scope)) {
        issues.push({ scope, reason: 'invalid_format' });
        continue;
      }

      const definition = byScope.get(scope);
      if (!definition) {
        issues.push({ scope, reason: 'unsupported' });
        continue;
      }

      if (!definition.enabled) {
        issues.push({ scope, reason: 'disabled' });
      }
    }

    return issues;
  }

  private async getDefinitions(tenantId?: string): Promise<ScopeDefinition[]> {
    const definitions = BUILT_IN_SCOPE_DEFINITIONS.map((scope) => ({
      ...scope,
      claimKeys: [...scope.claimKeys],
    }));
    const customScopes = tenantId
      ? await this.scopeRepository.listEnabledByTenantId(tenantId)
      : [];
    const seen = new Set(definitions.map((definition) => definition.scope));

    for (const scope of customScopes) {
      if (seen.has(scope.name)) {
        continue;
      }

      definitions.push({
        scope: scope.name,
        displayName: scope.displayName,
        claimKeys: scope.claimKeys,
        builtIn: scope.builtIn,
        enabled: scope.enabled && isValidScopeToken(scope.name),
      });
      seen.add(scope.name);
    }

    return definitions;
  }
}

function defaultClaimKeysFor(scope: string): string[] {
  if (scope === 'email') return ['email'];
  if (scope === 'profile') return ['profile'];
  return [];
}
