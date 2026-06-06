import type { GrantTypeValidationIssue } from '@application/ports/grant-type-registry.port';
import type {
  GrantTypeValidationContext,
  GrantTypeValidationStrategy,
} from './grant-type-validation-strategy';

export class EnabledGrantTypeStrategy implements GrantTypeValidationStrategy {
  validate({
    definition,
  }: GrantTypeValidationContext): GrantTypeValidationIssue[] {
    if (definition.enabled) {
      return [];
    }

    return [{ grantType: definition.grantType, reason: 'disabled' }];
  }
}

export class ClientTypeGrantTypeStrategy implements GrantTypeValidationStrategy {
  validate({
    definition,
    params,
  }: GrantTypeValidationContext): GrantTypeValidationIssue[] {
    if (definition.allowedClientTypes.includes(params.clientType)) {
      return [];
    }

    return [
      {
        grantType: definition.grantType,
        reason: 'client_type_not_allowed',
      },
    ];
  }
}

export class ApplicationTypeGrantTypeStrategy implements GrantTypeValidationStrategy {
  validate({
    definition,
    params,
  }: GrantTypeValidationContext): GrantTypeValidationIssue[] {
    if (definition.allowedApplicationTypes.includes(params.applicationType)) {
      return [];
    }

    return [
      {
        grantType: definition.grantType,
        reason: 'application_type_not_allowed',
      },
    ];
  }
}

export class ClientAuthenticationGrantTypeStrategy implements GrantTypeValidationStrategy {
  validate({
    definition,
    params,
  }: GrantTypeValidationContext): GrantTypeValidationIssue[] {
    if (
      !definition.requiresClientAuthentication ||
      params.tokenEndpointAuthMethod !== 'none'
    ) {
      return [];
    }

    return [
      {
        grantType: definition.grantType,
        reason: 'client_auth_required',
      },
    ];
  }
}

export class RequiredGrantTypeStrategy implements GrantTypeValidationStrategy {
  validate({
    definition,
    selectedGrantTypes,
  }: GrantTypeValidationContext): GrantTypeValidationIssue[] {
    return (definition.requiresGrantTypes ?? [])
      .filter((requiredGrantType) => !selectedGrantTypes.has(requiredGrantType))
      .map((requiredGrantType) => ({
        grantType: definition.grantType,
        reason: 'required_grant_missing',
        requiredGrantType,
      }));
  }
}

export const BUILT_IN_GRANT_TYPE_VALIDATION_STRATEGIES: readonly GrantTypeValidationStrategy[] =
  [
    new EnabledGrantTypeStrategy(),
    new ClientTypeGrantTypeStrategy(),
    new ApplicationTypeGrantTypeStrategy(),
    new ClientAuthenticationGrantTypeStrategy(),
    new RequiredGrantTypeStrategy(),
  ];
