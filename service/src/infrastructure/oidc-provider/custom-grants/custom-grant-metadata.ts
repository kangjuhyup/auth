import type { CustomGrantModel } from '@domain/models/custom-grant';
import type { CustomGrantRepository } from '@domain/repositories';
import type { CustomGrantTypeDefinition } from './custom-grant-type';

export function mergeCustomGrantMetadata(
  definition: CustomGrantTypeDefinition,
  metadata: CustomGrantModel,
): CustomGrantTypeDefinition {
  return {
    ...definition,
    displayName: metadata.displayName,
    enabled: definition.enabled && metadata.enabled,
    allowedClientTypes: metadata.allowedClientTypes,
    allowedApplicationTypes: metadata.allowedApplicationTypes,
    requiresClientAuthentication: metadata.requiresClientAuthentication,
    requiresGrantTypes: metadata.requiresGrantTypes,
  };
}

export async function resolveCustomGrantDefinitions(params: {
  tenantId?: string;
  repository?: CustomGrantRepository;
  definitions: readonly CustomGrantTypeDefinition[];
}): Promise<CustomGrantTypeDefinition[]> {
  if (!params.tenantId || !params.repository) {
    return params.definitions.map((definition) => ({ ...definition }));
  }

  const metadata = await params.repository.listByTenantId(params.tenantId);
  const byGrantType = new Map(
    metadata.map((grant) => [grant.grantType, grant]),
  );

  return params.definitions
    .filter((definition) => byGrantType.has(definition.grantType))
    .map((definition) =>
      mergeCustomGrantMetadata(
        definition,
        byGrantType.get(definition.grantType)!,
      ),
    );
}
