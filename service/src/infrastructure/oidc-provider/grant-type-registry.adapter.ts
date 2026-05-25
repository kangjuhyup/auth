import { Injectable, Optional } from '@nestjs/common';
import { GrantTypeRegistryPort } from '@application/ports/grant-type-registry.port';
import type {
  GrantTypeDefinition,
  GrantTypeValidationIssue,
  GrantTypeValidationParams,
} from '@application/ports/grant-type-registry.port';
import { CUSTOM_GRANT_TYPES } from './custom-grants';
import type { CustomGrantTypeDefinition } from './custom-grants';
import {
  BUILT_IN_GRANT_TYPE_VALIDATION_STRATEGIES,
  type GrantTypeValidationStrategy,
} from './grant-type-strategies';

const BUILT_IN_GRANT_TYPES: GrantTypeDefinition[] = [
  {
    grantType: 'authorization_code',
    displayName: 'Authorization Code',
    builtIn: true,
    enabled: true,
    allowedClientTypes: ['public', 'confidential'],
    allowedApplicationTypes: ['web', 'native'],
    requiresClientAuthentication: false,
  },
  {
    grantType: 'refresh_token',
    displayName: 'Refresh Token',
    builtIn: true,
    enabled: true,
    allowedClientTypes: ['public', 'confidential'],
    allowedApplicationTypes: ['web', 'native'],
    requiresClientAuthentication: false,
    requiresGrantTypes: ['authorization_code'],
  },
  {
    grantType: 'client_credentials',
    displayName: 'Client Credentials',
    builtIn: true,
    enabled: true,
    allowedClientTypes: ['confidential', 'service'],
    allowedApplicationTypes: ['web', 'native'],
    requiresClientAuthentication: true,
  },
  {
    grantType: 'implicit',
    displayName: 'Implicit',
    builtIn: true,
    enabled: true,
    allowedClientTypes: ['public', 'confidential'],
    allowedApplicationTypes: ['web', 'native'],
    requiresClientAuthentication: false,
  },
];

@Injectable()
export class OidcGrantTypeRegistryAdapter extends GrantTypeRegistryPort {
  constructor(
    @Optional()
    private readonly customGrantTypes: readonly CustomGrantTypeDefinition[] = CUSTOM_GRANT_TYPES,
    @Optional()
    private readonly validationStrategies: readonly GrantTypeValidationStrategy[] = BUILT_IN_GRANT_TYPE_VALIDATION_STRATEGIES,
  ) {
    super();
  }

  async listSupportedGrantTypes(): Promise<string[]> {
    return this.getDefinitions()
      .filter((grant) => grant.enabled)
      .map((grant) => grant.grantType);
  }

  async listDefinitions(): Promise<GrantTypeDefinition[]> {
    return this.getDefinitions().map((grant) => ({ ...grant }));
  }

  async validateClientGrantTypes(
    params: GrantTypeValidationParams,
  ): Promise<GrantTypeValidationIssue[]> {
    const definitions = await this.listDefinitions();
    const byType = new Map(
      definitions.map((definition) => [definition.grantType, definition]),
    );
    const selectedGrantTypes = new Set(params.grantTypes);
    const issues: GrantTypeValidationIssue[] = [];

    for (const grantType of selectedGrantTypes) {
      const definition = byType.get(grantType);

      if (!definition) {
        issues.push({ grantType, reason: 'unsupported' });
        continue;
      }

      issues.push(
        ...this.validationStrategies.flatMap((strategy) =>
          strategy.validate({
            definition,
            params,
            selectedGrantTypes,
          }),
        ),
      );
    }

    return issues;
  }

  private getDefinitions(): GrantTypeDefinition[] {
    return [...BUILT_IN_GRANT_TYPES, ...this.customGrantTypes].map((grant) => ({
      ...grant,
    }));
  }
}
