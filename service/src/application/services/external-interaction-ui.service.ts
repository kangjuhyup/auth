import { ForbiddenException, Injectable } from '@nestjs/common';
import { ClientRepository } from '@domain/repositories';
import { OidcInteractionPort } from '@application/ports/oidc-interaction.port';
import { TenantContextPort } from '@application/ports/tenant-context.port';
import { ExternalInteractionAccessPort } from '@application/ports/external-interaction-access.port';
import {
  ExternalInteractionUiPort,
  type ExternalInteractionAuthorization,
  type ExternalInteractionUiDecision,
} from '@application/ports/external-interaction-ui.port';
import type { TenantContext } from '@application/dto';

type ExternalClientBinding = Readonly<{
  tenant: TenantContext;
  clientId: string;
  url: URL | null;
}>;

@Injectable()
export class ExternalInteractionUiService extends ExternalInteractionUiPort {
  constructor(
    private readonly oidcInteraction: OidcInteractionPort,
    private readonly tenantContext: TenantContextPort,
    private readonly clientRepository: ClientRepository,
    private readonly access: ExternalInteractionAccessPort,
  ) {
    super();
  }

  async prepare(params: {
    tenantCode: string;
    uid: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }): Promise<ExternalInteractionUiDecision> {
    if (!params.tenant) return { mode: 'embedded' };

    const details = await this.oidcInteraction.getDetails(params);
    const client = await this.clientRepository.findByClientId(
      params.tenant.id,
      details.clientId,
    );
    if (!client?.enabled || !client.externalInteractionUiUrl) {
      return { mode: 'embedded' };
    }

    const configuredUrl = new URL(client.externalInteractionUiUrl);
    const issued = await this.access.issue({
      tenantId: params.tenant.id,
      tenantCode: params.tenantCode,
      clientId: client.clientId,
      uid: params.uid,
      origin: configuredUrl.origin,
    });
    configuredUrl.searchParams.set('tenantCode', params.tenantCode);
    configuredUrl.searchParams.set('uid', params.uid);
    configuredUrl.hash = new URLSearchParams({
      interaction_token: issued.accessToken,
      csrf_token: issued.csrfToken,
    }).toString();

    return {
      mode: 'external',
      redirectTo: configuredUrl.toString(),
      browserBinding: issued.browserBinding,
      maxAgeMs: Math.max(0, issued.claims.expiresAt.getTime() - Date.now()),
      secureCookies: configuredUrl.protocol === 'https:',
    };
  }

  async resolveCorsOrigin(params: {
    tenantCode: string;
    uid: string;
  }): Promise<string | null> {
    return (await this.resolveInteractionClient(params))?.url?.origin ?? null;
  }

  async authorize(params: {
    tenantCode: string;
    uid: string;
    origin?: string;
    accessToken?: string;
    csrfToken?: string;
    browserBinding?: string;
  }): Promise<ExternalInteractionAuthorization> {
    const binding = await this.resolveInteractionClient(params);
    if (!binding) throw denied();
    if (!binding.url) return { mode: 'embedded' };

    if (
      params.origin !== binding.url.origin ||
      !params.accessToken ||
      !params.csrfToken ||
      !params.browserBinding
    ) {
      throw denied();
    }

    const verified = await this.access.verify({
      accessToken: params.accessToken,
      csrfToken: params.csrfToken,
      browserBinding: params.browserBinding,
      tenantId: binding.tenant.id,
      tenantCode: params.tenantCode,
      clientId: binding.clientId,
      uid: params.uid,
      origin: binding.url.origin,
    });
    if (!verified) throw denied();

    return { mode: 'external', access: verified };
  }

  async consume(params: {
    tenantCode: string;
    uid: string;
    accessId: string;
  }): Promise<boolean> {
    return this.access.consume(params);
  }

  private async resolveInteractionClient(params: {
    tenantCode: string;
    uid: string;
  }): Promise<ExternalClientBinding | null> {
    const [tenant, interaction] = await Promise.all([
      this.tenantContext.findByCode(params.tenantCode),
      this.oidcInteraction.findInteractionBinding(params),
    ]);
    if (!tenant || !interaction) return null;

    const client = await this.clientRepository.findByClientId(
      tenant.id,
      interaction.clientId,
    );
    if (!client?.enabled) return null;

    return {
      tenant,
      clientId: client.clientId,
      url: client.externalInteractionUiUrl
        ? new URL(client.externalInteractionUiUrl)
        : null,
    };
  }
}

function denied(): ForbiddenException {
  return new ForbiddenException('External interaction request denied');
}
