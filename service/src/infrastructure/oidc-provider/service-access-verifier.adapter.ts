import { Inject, Injectable } from '@nestjs/common';
import {
  ServiceAccessError,
  ServiceAccessVerifierPort,
  USER_PROVISIONING_SCOPE,
  type ServicePrincipal,
} from '@application/ports/service-access-verifier.port';
import { parseScopeString } from '@domain/models/scope';
import { ClientRepository, TenantRepository } from '@domain/repositories';
import { OIDC_PROVIDER } from './oidc-provider.constants';
import { OidcProviderRegistry } from './oidc-provider.registry';

type ClientCredentialsLike = {
  clientId?: string;
  scope?: string;
  payload?: Record<string, unknown>;
  toJSON?: () => Record<string, unknown>;
};

@Injectable()
export class ServiceAccessVerifierAdapter extends ServiceAccessVerifierPort {
  constructor(
    @Inject(OIDC_PROVIDER) private readonly registry: OidcProviderRegistry,
    private readonly tenants: TenantRepository,
    private readonly clients: ClientRepository,
  ) {
    super();
  }

  async verify(
    tenantId: string,
    bearerToken: string,
  ): Promise<ServicePrincipal> {
    const tenant = await this.tenants.findById(tenantId);
    if (!tenant) throw new ServiceAccessError('unauthorized');

    const provider = await this.registry.get(tenant.code);
    const token = (await (provider as any).ClientCredentials.find(
      bearerToken,
    )) as ClientCredentialsLike | undefined;
    if (!token) throw new ServiceAccessError('unauthorized');

    const payload = this.extractPayload(token);
    const tokenTenantId = payload.tenant_id ?? payload.tenantId;
    const clientId = token.clientId ?? payload.client_id ?? payload.clientId;
    const scope = String(token.scope ?? payload.scope ?? '');
    const exp = payload.exp;
    if (
      tokenTenantId !== tenantId ||
      typeof clientId !== 'string' ||
      !clientId ||
      typeof exp !== 'number' ||
      exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new ServiceAccessError('unauthorized');
    }

    const client = await this.clients.findByClientId(tenantId, clientId);
    if (
      !client ||
      !client.enabled ||
      client.type !== 'service' ||
      !client.grantTypes.includes('client_credentials')
    ) {
      throw new ServiceAccessError('unauthorized');
    }
    if (!parseScopeString(scope).includes(USER_PROVISIONING_SCOPE)) {
      throw new ServiceAccessError('insufficient_scope');
    }
    return { clientId, scope };
  }

  private extractPayload(token: ClientCredentialsLike): Record<string, any> {
    if (token.payload && typeof token.payload === 'object')
      return token.payload;
    const json =
      typeof token.toJSON === 'function' ? token.toJSON() : undefined;
    if (json?.payload && typeof json.payload === 'object') {
      return json.payload as Record<string, any>;
    }
    return json ?? {};
  }
}
