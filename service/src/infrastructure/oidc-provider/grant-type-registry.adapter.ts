import { Injectable, Optional } from '@nestjs/common';
import { GrantTypeRegistryPort } from '@application/ports/grant-type-registry.port';
import type {
  GrantTypeDefinition,
  GrantTypeValidationIssue,
  GrantTypeValidationParams,
} from '@application/ports/grant-type-registry.port';
import { CUSTOM_GRANT_TYPES } from './custom-grants';
import type { CustomGrantTypeDefinition } from './custom-grants';

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

      if (!definition.enabled) {
        issues.push({ grantType, reason: 'disabled' });
      }

      if (!definition.allowedClientTypes.includes(params.clientType)) {
        issues.push({ grantType, reason: 'client_type_not_allowed' });
      }

      if (
        !definition.allowedApplicationTypes.includes(params.applicationType)
      ) {
        issues.push({ grantType, reason: 'application_type_not_allowed' });
      }

      if (
        definition.requiresClientAuthentication &&
        params.tokenEndpointAuthMethod === 'none'
      ) {
        issues.push({ grantType, reason: 'client_auth_required' });
      }

      for (const requiredGrantType of definition.requiresGrantTypes ?? []) {
        if (!selectedGrantTypes.has(requiredGrantType)) {
          issues.push({
            grantType,
            reason: 'required_grant_missing',
            requiredGrantType,
          });
        }
      }
    }

    return issues;
  }

  private getDefinitions(): GrantTypeDefinition[] {
    return [...BUILT_IN_GRANT_TYPES, ...this.customGrantTypes].map((grant) => ({
      ...grant,
    }));
  }
}
