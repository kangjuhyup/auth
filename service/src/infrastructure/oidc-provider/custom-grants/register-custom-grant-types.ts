import type Provider from 'oidc-provider';
import { CUSTOM_GRANT_TYPES } from './index';
import type {
  CustomGrantTypeContext,
  CustomGrantTypeDefinition,
} from './custom-grant-type';

export function registerCustomGrantTypes(
  provider: Provider,
  context: CustomGrantTypeContext,
  definitions: readonly CustomGrantTypeDefinition[] = CUSTOM_GRANT_TYPES,
): string[] {
  const registeredGrantTypes: string[] = [];

  for (const definition of definitions) {
    if (!definition.enabled) continue;

    provider.registerGrantType(
      definition.grantType,
      definition.createHandler(context),
      definition.parameters,
      definition.duplicateParameters,
    );
    registeredGrantTypes.push(definition.grantType);
  }

  return registeredGrantTypes;
}
