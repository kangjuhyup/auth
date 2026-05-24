import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Request } from 'express';
import type {
  InteractionCompletionResult,
  InteractionDetailsResult,
  InteractionIdpCallbackResult,
  InteractionIdpRedirectResult,
  InteractionJsonResult,
  InteractionRedirectResult,
  InteractionXmlResult,
} from '@application/ports/oidc-interaction.port';
import { OidcInteractionPort } from '@application/ports/oidc-interaction.port';
import type { TenantContext } from '@application/dto';
import { IdpPort } from '@application/ports/idp.port';
import { SamlSpPort } from '@application/ports/saml-sp.port';
import {
  ClientAuthPolicyRepository,
  ClientRepository,
  IdentityProviderRepository,
  TenantConfigRepository,
  UserIdentityRepository,
} from '@domain/repositories';
import { TenantConfigModel } from '@domain/models/tenant-config';
import { OIDC_PROVIDER } from './oidc-provider.constants';
import { OidcProviderRegistry } from './oidc-provider.registry';

@Injectable()
export class OidcInteractionAdapter extends OidcInteractionPort {
  constructor(
    @Inject(OIDC_PROVIDER) private readonly registry: OidcProviderRegistry,
    private readonly clientAuthPolicyRepo: ClientAuthPolicyRepository,
    private readonly clientRepo: ClientRepository,
    private readonly tenantConfigRepo: TenantConfigRepository,
    private readonly idpRepo: IdentityProviderRepository,
    private readonly userIdentityRepo: UserIdentityRepository,
    private readonly idpPort: IdpPort,
    private readonly samlSpPort: SamlSpPort,
  ) {
    super();
  }

  async getDetails(params: {
    tenantCode: string;
    uid: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }): Promise<InteractionDetailsResult> {
    const provider = await this.registry.get(params.tenantCode);
    const details = await provider.interactionDetails(
      params.req as any,
      params.res as any,
    );
    const { prompt, params: oidcParams } = details;
    const clientId = String(oidcParams.client_id ?? '');

    let idpList: InteractionDetailsResult['idpList'] = [];
    let mfaRequired = false;

    if (params.tenant) {
      const tenantPolicies = (
        (await this.tenantConfigRepo.findByTenantId(params.tenant.id)) ??
        this.createDefaultTenantConfig(params.tenant.id)
      ).getPolicies();
      const idps = await this.idpRepo.listEnabledByTenant(params.tenant.id);
      let allowedIdpProviderKeys = tenantPolicies.allowedIdp.providerKeys;

      const client = await this.clientRepo.findByClientId(
        params.tenant.id,
        clientId,
      );
      if (client) {
        const policy = await this.clientAuthPolicyRepo.findByClientRefId(
          client.id,
        );
        if (policy) {
          const effective = policy.resolveEffectivePolicy(
            tenantPolicies,
            client.refreshTokenTtlSec,
          );
          mfaRequired = effective.mfaRequired;
          allowedIdpProviderKeys = effective.allowedIdpProviderKeys;
        } else {
          mfaRequired = tenantPolicies.mfa.required;
        }
      } else {
        mfaRequired = tenantPolicies.mfa.required;
      }

      idpList = idps
        .filter(
          (idp) =>
            allowedIdpProviderKeys === null ||
            allowedIdpProviderKeys.includes(idp.provider),
        )
        .map((idp) => ({
          provider: idp.provider,
          name: idp.displayName,
          protocol: idp.protocol,
        }));
    }

    const missingScopes =
      prompt.name === 'consent'
        ? (((prompt.details as any).missingOIDCScope as string[] | undefined) ??
          [])
        : [];

    return {
      uid: params.uid,
      prompt: prompt.name,
      clientId,
      missingScopes,
      mfaRequired,
      idpList,
    };
  }

  async completeLogin(params: {
    tenantCode: string;
    req: unknown;
    res: unknown;
    userId: string;
  }): Promise<InteractionCompletionResult> {
    const provider = await this.registry.get(params.tenantCode);
    const redirectTo = await provider.interactionResult(
      params.req as any,
      params.res as any,
      { login: { accountId: params.userId } },
    );

    return { redirectTo };
  }

  async completeConsent(params: {
    tenantCode: string;
    req: unknown;
    res: unknown;
  }): Promise<InteractionJsonResult | InteractionCompletionResult> {
    const provider = await this.registry.get(params.tenantCode);
    const details = await provider.interactionDetails(
      params.req as any,
      params.res as any,
    );
    const { prompt, params: oidcParams, session } = details;

    if (prompt.name !== 'consent' || !session) {
      return {
        status: 400,
        body: {
          error: 'invalid_request',
          message: 'No active consent interaction',
        },
      };
    }

    const accountId = session.accountId;
    const clientId = oidcParams.client_id as string;
    const grant = details.grantId
      ? ((await provider.Grant.find(details.grantId)) ??
        new provider.Grant({ accountId, clientId }))
      : new provider.Grant({ accountId, clientId });

    const missingScope =
      ((prompt.details as any).missingOIDCScope as string[] | undefined) ?? [];
    if (missingScope.length) {
      grant.addOIDCScope(missingScope.join(' '));
    }

    const grantId = await grant.save();
    const redirectTo = await provider.interactionResult(
      params.req as any,
      params.res as any,
      { consent: { grantId } },
    );

    return { redirectTo };
  }

  async abort(params: {
    tenantCode: string;
    req: unknown;
    res: unknown;
  }): Promise<InteractionCompletionResult> {
    const provider = await this.registry.get(params.tenantCode);
    const redirectTo = await provider.interactionResult(
      params.req as any,
      params.res as any,
      {
        error: 'access_denied',
        error_description: 'End-User aborted interaction',
      },
    );

    return { redirectTo };
  }

  async delegateProviderCallback(params: {
    tenantCode: string;
    req: unknown;
    res: unknown;
  }): Promise<unknown> {
    const req = params.req as Request;
    const provider = await this.registry.get(params.tenantCode);
    const prefix = `/t/${params.tenantCode}/oidc`;
    if (req.url.startsWith(prefix)) {
      req.url = req.url.slice(prefix.length) || '/';
    }

    return provider.callback()(params.req as any, params.res as any);
  }

  async getIdpRedirect(params: {
    tenantCode: string;
    uid: string;
    providerName: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }): Promise<InteractionIdpRedirectResult> {
    if (!params.tenant) {
      return { status: 400, body: { error: 'tenant_not_found' } };
    }

    const idpConfig = await this.idpRepo.findByTenantAndProvider(
      params.tenant.id,
      params.providerName,
    );
    if (!idpConfig || !idpConfig.enabled) {
      return { status: 404, body: { error: 'idp_not_found' } };
    }
    if (
      !(await this.isIdpAllowedForInteraction({
        tenant: params.tenant,
        tenantCode: params.tenantCode,
        providerName: params.providerName,
        req: params.req,
        res: params.res,
      }))
    ) {
      return { status: 403, body: { error: 'idp_not_allowed' } };
    }

    if (idpConfig.protocol === 'saml2') {
      if (!idpConfig.samlConfig) {
        return { status: 400, body: { error: 'idp_saml_config_missing' } };
      }

      const relayState = this.createSamlRelayState(params.uid);
      const redirectTo = await this.samlSpPort.getLoginUrl({
        tenantId: params.tenant.id,
        provider: idpConfig.provider,
        issuer: this.samlIssuer(
          params.req,
          params.tenantCode,
          params.providerName,
          idpConfig.clientId,
        ),
        callbackUrl: idpConfig.redirectUri,
        config: idpConfig.samlConfig,
        relayState,
      });

      return { redirectTo };
    }

    const req = params.req as Request;
    const callbackUrl = `${req.protocol}://${req.get('host')}/t/${params.tenantCode}/interaction/${params.uid}/idp/${params.providerName}/callback`;
    const state = `${params.uid}:${randomBytes(16).toString('hex')}`;
    const redirectTo = this.idpPort.getAuthorizationUrl(
      idpConfig.provider,
      idpConfig.oauthConfig,
      idpConfig.clientId,
      callbackUrl,
      state,
    );

    return { redirectTo };
  }

  async handleIdpCallback(params: {
    tenantCode: string;
    uid: string;
    providerName: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }): Promise<InteractionIdpCallbackResult> {
    if (!params.tenant) {
      return this.interactionRedirect(
        params.tenantCode,
        params.uid,
        'tenant_not_found',
      );
    }

    const req = params.req as Request;
    const code = req.query.code as string | undefined;
    if (!code) {
      return this.interactionRedirect(
        params.tenantCode,
        params.uid,
        'idp_no_code',
      );
    }

    const idpConfig = await this.idpRepo.findByTenantAndProvider(
      params.tenant.id,
      params.providerName,
    );
    if (!idpConfig) {
      return this.interactionRedirect(
        params.tenantCode,
        params.uid,
        'idp_not_found',
      );
    }
    if (
      !(await this.isIdpAllowedForInteraction({
        tenant: params.tenant,
        tenantCode: params.tenantCode,
        providerName: params.providerName,
        req: params.req,
        res: params.res,
      }))
    ) {
      return this.interactionRedirect(
        params.tenantCode,
        params.uid,
        'idp_not_allowed',
      );
    }

    try {
      const callbackUrl = `${req.protocol}://${req.get('host')}/t/${params.tenantCode}/interaction/${params.uid}/idp/${params.providerName}/callback`;
      const userInfo = await this.idpPort.exchangeCode(
        idpConfig.provider,
        idpConfig.oauthConfig,
        idpConfig.clientId,
        idpConfig.clientSecret,
        code,
        callbackUrl,
      );
      const identity = await this.userIdentityRepo.findByProviderSub(
        params.tenant.id,
        params.providerName,
        userInfo.sub,
      );
      if (!identity) {
        return this.interactionRedirect(
          params.tenantCode,
          params.uid,
          'idp_user_not_linked',
        );
      }

      const provider = await this.registry.get(params.tenantCode);
      await provider.interactionFinished(params.req as any, params.res as any, {
        login: { accountId: identity.userId },
      });

      return { redirectTo: '' };
    } catch {
      return this.interactionRedirect(
        params.tenantCode,
        params.uid,
        'idp_exchange_failed',
      );
    }
  }

  async getSamlMetadata(params: {
    tenantCode: string;
    providerName: string;
    req: unknown;
    tenant?: TenantContext;
  }): Promise<InteractionJsonResult | InteractionXmlResult> {
    if (!params.tenant) {
      return { status: 400, body: { error: 'tenant_not_found' } };
    }

    const idpConfig = await this.idpRepo.findByTenantAndProvider(
      params.tenant.id,
      params.providerName,
    );
    if (!idpConfig || !idpConfig.enabled || idpConfig.protocol !== 'saml2') {
      return { status: 404, body: { error: 'idp_not_found' } };
    }
    if (!idpConfig.samlConfig) {
      return { status: 400, body: { error: 'idp_saml_config_missing' } };
    }

    const body = this.samlSpPort.generateMetadata({
      tenantId: params.tenant.id,
      provider: idpConfig.provider,
      issuer: this.samlIssuer(
        params.req,
        params.tenantCode,
        params.providerName,
        idpConfig.clientId,
      ),
      callbackUrl: idpConfig.redirectUri,
      config: idpConfig.samlConfig,
    });

    return { contentType: 'application/samlmetadata+xml', body };
  }

  async handleSamlCallback(params: {
    tenantCode: string;
    providerName: string;
    relayState?: string;
    samlResponse?: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }): Promise<InteractionJsonResult | InteractionRedirectResult> {
    const parsedRelay = this.parseSamlRelayState(params.relayState);
    if (!parsedRelay) {
      return { status: 400, body: { error: 'invalid_saml_relay_state' } };
    }

    if (!params.tenant) {
      return this.interactionRedirect(
        params.tenantCode,
        parsedRelay.uid,
        'tenant_not_found',
      );
    }

    const idpConfig = await this.idpRepo.findByTenantAndProvider(
      params.tenant.id,
      params.providerName,
    );
    if (!idpConfig || idpConfig.protocol !== 'saml2' || !idpConfig.samlConfig) {
      return this.interactionRedirect(
        params.tenantCode,
        parsedRelay.uid,
        'idp_not_found',
      );
    }
    if (
      !(await this.isIdpAllowedForInteraction({
        tenant: params.tenant,
        tenantCode: params.tenantCode,
        providerName: params.providerName,
        req: params.req,
        res: params.res,
      }))
    ) {
      return this.interactionRedirect(
        params.tenantCode,
        parsedRelay.uid,
        'idp_not_allowed',
      );
    }

    try {
      const userInfo = await this.samlSpPort.validatePostResponse({
        tenantId: params.tenant.id,
        provider: idpConfig.provider,
        issuer: this.samlIssuer(
          params.req,
          params.tenantCode,
          params.providerName,
          idpConfig.clientId,
        ),
        callbackUrl: idpConfig.redirectUri,
        config: idpConfig.samlConfig,
        relayState: params.relayState,
        samlResponse: params.samlResponse,
      });
      const identity = await this.userIdentityRepo.findByProviderSub(
        params.tenant.id,
        params.providerName,
        userInfo.sub,
      );
      if (!identity) {
        return this.interactionRedirect(
          params.tenantCode,
          parsedRelay.uid,
          'idp_user_not_linked',
        );
      }

      const provider = await this.registry.get(params.tenantCode);
      await provider.interactionFinished(params.req as any, params.res as any, {
        login: { accountId: identity.userId },
      });

      return { redirectTo: '' };
    } catch {
      return this.interactionRedirect(
        params.tenantCode,
        parsedRelay.uid,
        'idp_exchange_failed',
      );
    }
  }

  private createSamlRelayState(uid: string): string {
    return `uid:${uid}:${randomBytes(16).toString('hex')}`;
  }

  private parseSamlRelayState(
    relayState: string | undefined,
  ): { uid: string } | null {
    if (!relayState) {
      return null;
    }
    const parts = relayState.split(':');
    if (parts.length !== 3 || parts[0] !== 'uid' || !parts[1] || !parts[2]) {
      return null;
    }
    return { uid: parts[1] };
  }

  private samlIssuer(
    reqLike: unknown,
    tenantCode: string,
    providerName: string,
    configuredIssuer: string,
  ): string {
    const req = reqLike as Request;
    return (
      configuredIssuer ||
      `${req.protocol}://${req.get('host')}/t/${tenantCode}/interaction/saml/${providerName}/metadata`
    );
  }

  private async isIdpAllowedForInteraction(params: {
    tenant: TenantContext;
    tenantCode: string;
    providerName: string;
    req: unknown;
    res: unknown;
  }): Promise<boolean> {
    const provider = await this.registry.get(params.tenantCode);
    const details = await provider.interactionDetails(
      params.req as any,
      params.res as any,
    );
    const clientId = String(details.params.client_id ?? '');
    const tenantPolicies = (
      (await this.tenantConfigRepo.findByTenantId(params.tenant.id)) ??
      this.createDefaultTenantConfig(params.tenant.id)
    ).getPolicies();
    let allowedProviderKeys = tenantPolicies.allowedIdp.providerKeys;

    const client = await this.clientRepo.findByClientId(
      params.tenant.id,
      clientId,
    );
    if (client) {
      const policy = await this.clientAuthPolicyRepo.findByClientRefId(
        client.id,
      );
      if (policy) {
        allowedProviderKeys = policy.resolveEffectivePolicy(
          tenantPolicies,
          client.refreshTokenTtlSec,
        ).allowedIdpProviderKeys;
      }
    }

    return (
      allowedProviderKeys === null ||
      allowedProviderKeys.includes(params.providerName)
    );
  }

  private createDefaultTenantConfig(tenantId: string): TenantConfigModel {
    return new TenantConfigModel({
      tenantId,
      signupPolicy: 'open',
      requirePhoneVerify: false,
      brandName: null,
      accessTokenTtlSec: 60 * 60,
      refreshTokenTtlSec: 14 * 24 * 60 * 60,
      extra: null,
    });
  }

  private interactionRedirect(
    tenantCode: string,
    uid: string,
    error: string,
  ): InteractionRedirectResult {
    return {
      redirectTo: `/t/${tenantCode}/interaction/${uid}?error=${error}`,
    };
  }
}
