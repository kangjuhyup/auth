import { createHash } from 'node:crypto';
import type { GrantTypeRegistryPort } from '@application/ports/grant-type-registry.port';
import type { ScopeRegistryPort } from '@application/ports/scope-registry.port';
import type { TenantRepository } from '@domain/repositories';

export function createOidcProviderConfigurationRevisionResolver(params: {
  tenantRepository: TenantRepository;
  scopeRegistry: ScopeRegistryPort;
  grantTypeRegistry: GrantTypeRegistryPort;
}): (tenantCode: string) => Promise<string> {
  return async (tenantCode: string): Promise<string> => {
    const tenant = await params.tenantRepository.findByCode(tenantCode);
    if (!tenant) throw new Error('OIDC tenant not found');

    const [supportedScopes, supportedGrantTypes] = await Promise.all([
      params.scopeRegistry.listSupportedScopes(tenant.id),
      params.grantTypeRegistry.listSupportedGrantTypes(tenant.id),
    ]);
    const snapshot = JSON.stringify({
      tenantId: tenant.id,
      supportedScopes: normalize(supportedScopes),
      supportedGrantTypes: normalize(supportedGrantTypes),
    });

    return createHash('sha256').update(snapshot).digest('hex');
  };
}

function normalize(values: string[]): string[] {
  return [...new Set(values)].sort();
}
