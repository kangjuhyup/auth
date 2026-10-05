import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { ExternalSignupStorePort } from '@application/ports/external-signup.port';
import { isIP } from 'node:net';
import type { Request } from 'express';
import type {
  InteractionBindingResult,
  InteractionCompletionResult,
  InteractionDetailsResult,
  InteractionIdpCallbackResult,
  InteractionIdpRedirectResult,
  InteractionJsonResult,
  InteractionLoginResult,
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
  EventRepository,
  IdentityProviderRepository,
  TenantConfigRepository,
  UserIdentityRepository,
} from '@domain/repositories';
import { EventModel } from '@domain/models/event';
import { TenantConfigModel } from '@domain/models/tenant-config';
import { OIDC_PROVIDER } from './oidc-provider.constants';
import { OidcProviderRegistry } from './oidc-provider.registry';
import { OperationalMetricsPort } from '@application/ports/operational-metrics.port';
import { OidcSessionControlService } from './session/oidc-session-control.service';
import type { OidcSessionRecord } from './session/oidc-session-index.store';
import { ResourceOrigin } from '@domain/value-objects/resource-origin';

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
    private readonly metrics: OperationalMetricsPort,
    private readonly eventRepo: EventRepository,
    private readonly sessionControl: OidcSessionControlService,
    @Optional() private readonly externalSignup?: ExternalSignupStorePort,
  ) {
    super();
  }

  async findInteractionBinding(params: {
    tenantCode: string;
    uid: string;
  }): Promise<InteractionBindingResult | null> {
    const provider = await this.registry.get(params.tenantCode);
    const interaction = await provider.Interaction.find(params.uid);
    const clientId = String(interaction?.params?.client_id ?? '');
    if (!interaction || interaction.uid !== params.uid || !clientId) {
      return null;
    }

    return { clientId };
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
    if (details.uid !== params.uid) {
      throw new Error('Interaction UID binding mismatch');
    }
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

    const signup =
      params.tenant && this.externalSignup
        ? await this.externalSignup.getInteractionTicket(
            params.tenant.id,
            params.uid,
          )
        : null;
    const externalSignup =
      signup &&
      signup.clientId === clientId &&
      signup.browserHash === externalBrowserHash(params.req, params.tenantCode)
        ? {
            ticket: signup.ticket,
            provider: signup.provider,
            expiresAt: signup.expiresAt,
            attemptId: signup.attemptId,
          }
        : undefined;
    return {
      ...(externalSignup ? { externalSignup } : {}),
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
    tenant?: TenantContext;
  }): Promise<InteractionLoginResult> {
    const provider = await this.registry.get(params.tenantCode);
    const conflict = await this.enforceSessionPolicy({
      tenantCode: params.tenantCode,
      req: params.req,
      res: params.res,
      tenant: params.tenant,
      userId: params.userId,
    });
    if (conflict) return conflict;

    const result = { login: { accountId: params.userId } };
    const redirectTo = await provider.interactionResult(
      params.req as any,
      params.res as any,
      result,
    );

    return {
      redirectTo: assertSafeInteractionReturnTo(provider.issuer, redirectTo),
    };
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

    const missingResourceScopes =
      ((prompt.details as any).missingResourceScopes as
        | Record<string, string[]>
        | undefined) ?? {};
    for (const [resource, scopes] of Object.entries(missingResourceScopes)) {
      grant.addResourceScope(
        ResourceOrigin.of(resource).value,
        scopes.join(' '),
      );
    }

    const grantId = await grant.save();
    const redirectTo = await provider.interactionResult(
      params.req as any,
      params.res as any,
      { consent: { grantId } },
    );

    return {
      redirectTo: assertSafeInteractionReturnTo(provider.issuer, redirectTo),
    };
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

    return {
      redirectTo: assertSafeInteractionReturnTo(provider.issuer, redirectTo),
    };
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

    const startedAt = Date.now();
    const endpoint = getClientAuthenticatedEndpoint(req.url);
    const tokenEndpoint = endpoint === 'token';
    const grantType = tokenEndpoint ? getGrantType(req) : null;

    try {
      const result = await provider.callback()(
        params.req as any,
        params.res as any,
      );
      if (tokenEndpoint && getStatusCode(params.res) < 400) {
        this.metrics.incrementCounter('token_issued_total', {
          tenantCode: params.tenantCode,
        });
        if (grantType === 'refresh_token') {
          this.metrics.incrementCounter('refresh_token_exchange_total', {
            tenantCode: params.tenantCode,
          });
        }
      }
      return result;
    } catch (error) {
      if (endpoint) {
        const errorCode = getOidcErrorCode(error);
        if (
          errorCode === 'invalid_client' ||
          (tokenEndpoint && errorCode === 'invalid_grant')
        ) {
          this.metrics.incrementCounter(`${errorCode}_total`, {
            tenantCode: params.tenantCode,
          });
        }
        if (errorCode === 'invalid_client') {
          try {
            await this.auditClientAuthenticationFailure(
              params.tenantCode,
              endpoint,
              req,
            );
          } catch {
            this.metrics.incrementCounter('oidc_audit_failure_total', {
              tenantCode: params.tenantCode,
            });
          }
        }
      }
      throw error;
    } finally {
      if (tokenEndpoint) {
        this.metrics.observeLatency(
          'token_endpoint_latency_ms',
          Date.now() - startedAt,
          { tenantCode: params.tenantCode },
        );
      }
    }
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

    if (!this.externalSignup)
      return { status: 503, body: { error: 'external_signup_unavailable' } };
    const req = params.req as Request;
    const provider = await this.registry.get(params.tenantCode);
    const details = await provider.interactionDetails(
      req as any,
      params.res as any,
    );
    if (details.uid !== params.uid || details.prompt.name !== 'login')
      return { status: 403, body: { error: 'interaction_denied' } };
    const browserHash = externalBrowserHash(req, params.tenantCode);
    if (!browserHash)
      return { status: 403, body: { error: 'interaction_denied' } };
    const callbackUrl = `${new URL(provider.issuer).origin}/t/${params.tenantCode}/interaction/idp/${params.providerName}/callback`;
    const state = randomBytes(32).toString('base64url');
    const browser = randomBytes(32).toString('base64url');
    (params.res as any).cookie(oauthCookie(params.providerName), browser, {
      httpOnly: true,
      secure: new URL(provider.issuer).protocol === 'https:',
      sameSite: 'lax',
      path: new URL(callbackUrl).pathname,
      maxAge: 600000,
    });
    await this.externalSignup.putState(state, {
      tenantId: params.tenant.id,
      tenantCode: params.tenantCode,
      clientId: String(details.params.client_id),
      uid: params.uid,
      provider: params.providerName,
      redirectUri: callbackUrl,
      intent: req.query.intent === 'signup' ? 'signup' : 'login',
      browserHash,
      callbackHash: hash(browser),
    });
    return {
      redirectTo: this.idpPort.getAuthorizationUrl(
        idpConfig.provider,
        idpConfig.oauthConfig,
        idpConfig.clientId,
        callbackUrl,
        state,
      ),
    };
  }

  async handleIdpCallback(params: {
    tenantCode: string;
    providerName: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }): Promise<InteractionIdpCallbackResult> {
    const req = params.req as Request;
    const state =
      typeof req.query.state === 'string' &&
      /^[A-Za-z0-9_-]{43}$/.test(req.query.state)
        ? req.query.state
        : '';
    const session =
      state && this.externalSignup
        ? await this.externalSignup.consumeState(state)
        : null;
    if (
      !session ||
      !params.tenant ||
      session.tenantId !== params.tenant.id ||
      session.tenantCode !== params.tenantCode ||
      session.provider !== params.providerName ||
      session.callbackHash !==
        hash(readCookie(req, oauthCookie(params.providerName)) ?? '')
    )
      return { redirectTo: '/' };
    (params.res as any).clearCookie(oauthCookie(params.providerName), {
      path: new URL(session.redirectUri).pathname,
    });
    const fail = (error: string) =>
      this.interactionRedirect(session.tenantCode, session.uid, error);
    if (
      req.query.error ||
      typeof req.query.code !== 'string' ||
      !req.query.code ||
      req.query.code.length > 4096
    )
      return fail('idp_no_code');
    const config = await this.idpRepo.findByTenantAndProvider(
      session.tenantId,
      session.provider,
    );
    if (!config?.enabled || config.protocol !== 'oauth2')
      return fail('idp_not_found');
    const binding = await this.findInteractionBinding({
      tenantCode: session.tenantCode,
      uid: session.uid,
    });
    if (!binding || binding.clientId !== session.clientId)
      return fail('interaction_denied');
    try {
      const info = await this.idpPort.exchangeCode(
        config.provider,
        config.oauthConfig,
        config.clientId,
        config.clientSecret,
        req.query.code,
        session.redirectUri,
      );
      if (!validExternalSubject(info.sub)) return fail('idp_missing_subject');
      await this.externalSignup!.putIdentity({
        ...session,
        providerSub: info.sub,
        profile: minimumProfile(info.profile),
      });
      return {
        redirectTo: `/t/${session.tenantCode}/interaction/${session.uid}/idp/${session.provider}/continue`,
      };
    } catch {
      return fail('idp_exchange_failed');
    }
  }

  async continueIdpLogin(params: {
    tenantCode: string;
    uid: string;
    providerName: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }): Promise<{ userId: string; uid: string } | InteractionRedirectResult> {
    if (!params.tenant || !this.externalSignup)
      return this.interactionRedirect(
        params.tenantCode,
        params.uid,
        'interaction_denied',
      );
    const provider = await this.registry.get(params.tenantCode);
    const details = await provider.interactionDetails(
      params.req as any,
      params.res as any,
    );
    if (details.uid !== params.uid || details.prompt.name !== 'login')
      return this.interactionRedirect(
        params.tenantCode,
        params.uid,
        'interaction_denied',
      );
    const verified = await this.externalSignup.consumeIdentity(
      params.tenant.id,
      params.uid,
    );
    if (
      !verified ||
      verified.provider !== params.providerName ||
      verified.clientId !== String(details.params.client_id) ||
      verified.browserHash !==
        externalBrowserHash(params.req, params.tenantCode) ||
      !(await this.isIdpAllowedForInteraction({
        ...params,
        tenant: params.tenant,
      }))
    )
      return this.interactionRedirect(
        params.tenantCode,
        params.uid,
        'interaction_denied',
      );
    const identity = await this.userIdentityRepo.findByProviderSub(
      params.tenant.id,
      verified.provider,
      verified.providerSub,
    );
    if (!identity || verified.intent === 'signup') {
      await this.externalSignup.issueTicket(verified);
      return {
        redirectTo: `/t/${params.tenantCode}/interaction/${params.uid}`,
      };
    }
    return { userId: identity.userId, uid: params.uid };
  }

  async resolveExternalSignup(params: {
    tenantCode: string;
    uid: string;
    ticket: string;
    attemptId: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }): Promise<{ userId: string }> {
    const ticket = await this.externalSignup?.getTicket(params.ticket);
    const provider = await this.registry.get(params.tenantCode);
    const details = await provider.interactionDetails(
      params.req as any,
      params.res as any,
    );
    if (
      !ticket ||
      !ticket.subject ||
      !params.tenant ||
      ticket.tenantId !== params.tenant.id ||
      ticket.tenantCode !== params.tenantCode ||
      ticket.uid !== params.uid ||
      details.uid !== params.uid ||
      details.prompt.name !== 'login' ||
      ticket.clientId !== String(details.params.client_id) ||
      ticket.attemptId !== params.attemptId ||
      ticket.browserHash !==
        externalBrowserHash(params.req, params.tenantCode) ||
      Date.parse(ticket.expiresAt) <= Date.now()
    )
      throw new Error('interaction_denied');
    const identity = await this.userIdentityRepo.findByProviderSub(
      params.tenant.id,
      ticket.provider,
      ticket.providerSub,
    );
    if (!identity || identity.userId !== ticket.subject)
      throw new Error('interaction_denied');
    return { userId: ticket.subject };
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
      const conflict = await this.enforceSessionPolicy({
        tenantCode: params.tenantCode,
        req: params.req,
        res: params.res,
        tenant: params.tenant,
        userId: identity.userId,
      });
      if (conflict) {
        return this.interactionRedirect(
          params.tenantCode,
          parsedRelay.uid,
          'session_limit_exceeded',
        );
      }

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
    if (!client || client.enabled === false) return false;
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

  private async enforceSessionPolicy(params: {
    tenantCode: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
    userId: string;
  }): Promise<InteractionJsonResult | null> {
    const tenant =
      params.tenant ??
      ((params.req as any)?.tenant as TenantContext | undefined);
    if (!tenant) return null;

    const provider = await this.registry.get(params.tenantCode);
    const details = await provider.interactionDetails(
      params.req as any,
      params.res as any,
    );
    const clientId = String(details.params?.client_id ?? '');
    if (!clientId) return null;

    const tenantPolicies = (
      (await this.tenantConfigRepo.findByTenantId(tenant.id)) ??
      this.createDefaultTenantConfig(tenant.id)
    ).getPolicies();
    const client = await this.clientRepo.findByClientId(tenant.id, clientId);
    const policy = client?.id
      ? await this.clientAuthPolicyRepo.findByClientRefId(client.id)
      : null;
    const effective = policy?.resolveEffectivePolicy(
      tenantPolicies,
      client?.refreshTokenTtlSec,
    ) ?? {
      loginSessionMode: tenantPolicies.session.loginSessionMode,
      maxConcurrentSessions: tenantPolicies.session.maxConcurrentSessions,
      sessionConflictAction: tenantPolicies.session.sessionConflictAction,
    };
    const limit =
      effective.loginSessionMode === 'single'
        ? 1
        : effective.maxConcurrentSessions;
    if (limit === null || limit < 1) return null;

    const activeSessions = await this.sessionControl.listActiveSessions({
      tenantId: tenant.id,
      clientId,
      accountId: params.userId,
    });
    if (activeSessions.length < limit) return null;

    if (effective.sessionConflictAction === 'deny_new_login') {
      await this.recordSessionPolicyAudit({
        tenantId: tenant.id,
        userId: params.userId,
        clientId,
        action: 'ACCESS_DENIED',
        success: false,
        reason: 'ConcurrentSessionLimitExceeded',
        affectedSessions: activeSessions.length,
        limit,
        req: params.req,
      });
      return {
        status: 409,
        body: {
          error: 'session_limit_exceeded',
          message: 'Concurrent session limit exceeded',
        },
      };
    }

    const targets = this.selectSessionsToRevoke(
      activeSessions,
      limit,
      effective.sessionConflictAction,
    );
    await this.sessionControl.revokeSessions(targets);
    await this.recordSessionPolicyAudit({
      tenantId: tenant.id,
      userId: params.userId,
      clientId,
      action: 'TOKEN_REVOKED',
      success: true,
      reason: 'PreviousSessionsRevokedByPolicy',
      affectedSessions: targets.length,
      limit,
      req: params.req,
    });

    return null;
  }

  private selectSessionsToRevoke(
    sessions: readonly OidcSessionRecord[],
    limit: number,
    action:
      | 'deny_new_login'
      | 'revoke_previous_sessions'
      | 'revoke_oldest_session',
  ): readonly OidcSessionRecord[] {
    if (action === 'revoke_oldest_session') {
      return sessions.slice(0, Math.max(1, sessions.length - limit + 1));
    }

    return sessions;
  }

  private async recordSessionPolicyAudit(params: {
    tenantId: string;
    userId: string;
    clientId: string;
    action: 'ACCESS_DENIED' | 'TOKEN_REVOKED';
    success: boolean;
    reason: string;
    affectedSessions: number;
    limit: number;
    req: unknown;
  }): Promise<void> {
    const req = params.req as Request;
    await this.eventRepo.save(
      new EventModel({
        tenantId: params.tenantId,
        userId: params.userId,
        clientId: params.clientId,
        category: 'SECURITY',
        severity: params.success ? 'INFO' : 'WARN',
        action: params.action,
        resourceType: 'oidc-session',
        resourceId: params.userId,
        success: params.success,
        reason: params.reason,
        ip: null,
        userAgent: req.get?.('user-agent') ?? null,
        correlationId:
          (req as any).correlationId ??
          req.get?.('x-correlation-id') ??
          req.get?.('x-request-id') ??
          null,
        metadata: {
          affectedSessions: params.affectedSessions,
          limit: params.limit,
        },
        occurredAt: new Date(),
      }),
    );
  }

  private async auditClientAuthenticationFailure(
    tenantCode: string,
    endpoint: ClientAuthenticatedEndpoint,
    req: Request,
  ): Promise<void> {
    const tenant = (req as any).tenant as TenantContext | undefined;
    if (!tenant?.id) {
      return;
    }

    const publicClientId = getSafeAuditClientId(getClientId(req));
    const client = publicClientId
      ? await this.clientRepo.findByClientId(tenant.id, publicClientId)
      : null;
    const reason = resolveClientAuthenticationFailureReason(client, req);

    await this.eventRepo.save(
      new EventModel({
        tenantId: tenant.id,
        clientId: client?.id ?? null,
        category: 'SECURITY',
        severity: 'WARN',
        action: 'ACCESS_DENIED',
        resourceType: 'oidc-client',
        resourceId: truncateAuditText(publicClientId, 191),
        success: false,
        reason,
        ip: getIpBuffer(req),
        userAgent: truncateAuditText(getHeader(req, 'user-agent'), 255),
        correlationId: truncateAuditText(getCorrelationId(req), 128),
        metadata: {
          tenantCode,
          endpoint,
          ...(endpoint === 'token' ? { grantType: getGrantType(req) } : {}),
        },
        occurredAt: new Date(),
      }),
    );
  }
}

type ClientAuthenticatedEndpoint = 'token' | 'introspection';

export function assertSafeInteractionReturnTo(
  issuer: string,
  redirectTo: string,
): string {
  const issuerUrl = new URL(issuer);
  const target = new URL(redirectTo, issuerUrl);
  if (target.origin !== issuerUrl.origin) {
    throw new Error('Unsafe interaction return URL');
  }
  return redirectTo;
}

function getClientAuthenticatedEndpoint(
  url: string,
): ClientAuthenticatedEndpoint | null {
  if (url === '/token' || url.startsWith('/token?')) return 'token';
  if (
    url === '/token/introspection' ||
    url.startsWith('/token/introspection?')
  ) {
    return 'introspection';
  }
  return null;
}

function getGrantType(req: Request): string | null {
  const bodyGrantType = (req as any).body?.grant_type;
  if (typeof bodyGrantType === 'string') {
    return bodyGrantType;
  }

  const queryGrantType = (req as any).query?.grant_type;
  if (typeof queryGrantType === 'string') {
    return queryGrantType;
  }

  return null;
}

function getClientId(req: Request): string | null {
  const bodyClientId = (req as any).body?.client_id;
  if (typeof bodyClientId === 'string' && bodyClientId.length > 0) {
    return bodyClientId;
  }

  const queryClientId = (req as any).query?.client_id;
  if (typeof queryClientId === 'string' && queryClientId.length > 0) {
    return queryClientId;
  }

  const basicCredentials = getBasicCredentials(req);
  return basicCredentials?.clientId ?? null;
}

function getSafeAuditClientId(value: string | null): string | null {
  if (!value || value.length > 255) {
    return null;
  }
  return /^[\x21-\x7e]+$/.test(value) ? value : null;
}

function getBasicCredentials(
  req: Request,
): { clientId: string; clientSecret: string | null } | null {
  const authorization = getHeader(req, 'authorization');
  if (!authorization?.startsWith('Basic ')) {
    return null;
  }

  const decoded = Buffer.from(authorization.slice('Basic '.length), 'base64')
    .toString('utf8')
    .trim();
  const separatorIndex = decoded.indexOf(':');
  const rawClientId =
    separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : decoded;
  if (!rawClientId) {
    return null;
  }

  const rawClientSecret =
    separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : null;

  return {
    clientId: safeDecodeURIComponent(rawClientId),
    clientSecret:
      rawClientSecret === null ? null : safeDecodeURIComponent(rawClientSecret),
  };
}

function hasPresentedClientSecret(req: Request): boolean {
  const bodySecret = (req as any).body?.client_secret;
  if (typeof bodySecret === 'string' && bodySecret.length > 0) {
    return true;
  }

  const basicCredentials = getBasicCredentials(req);
  return Boolean(basicCredentials?.clientSecret);
}

function resolveClientAuthenticationFailureReason(
  client: { enabled?: boolean; secretEnc?: string | null } | null,
  req: Request,
): string {
  if (!client) {
    return 'InvalidClient';
  }
  if (client.enabled === false) {
    return 'InactiveClient';
  }
  if (hasPresentedClientSecret(req)) {
    return 'ClientSecretMismatch';
  }
  return 'ClientAuthenticationFailed';
}

function getIpBuffer(req: Request): Buffer | null {
  return req.ip && isIP(req.ip) !== 0 ? Buffer.from(req.ip, 'utf8') : null;
}

function truncateAuditText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  return Array.from(value).slice(0, maxLength).join('');
}

function getCorrelationId(req: Request): string | null {
  const requestCorrelationId = (req as any).correlationId;
  if (typeof requestCorrelationId === 'string' && requestCorrelationId) {
    return requestCorrelationId;
  }

  return getHeader(req, 'x-correlation-id') ?? getHeader(req, 'x-request-id');
}

function getHeader(req: Request, name: string): string | null {
  const fromGetter = req.get?.(name);
  if (typeof fromGetter === 'string' && fromGetter.length > 0) {
    return fromGetter;
  }

  const header = req.headers?.[name.toLowerCase()];
  if (Array.isArray(header)) {
    return header[0] ?? null;
  }
  return typeof header === 'string' && header.length > 0 ? header : null;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getStatusCode(res: unknown): number {
  const statusCode = (res as { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' ? statusCode : 200;
}

function getOidcErrorCode(error: unknown): string | null {
  const code = (error as { error?: unknown })?.error;
  if (typeof code === 'string') {
    return code;
  }
  const message = error instanceof Error ? error.message : '';
  if (message.includes('invalid_grant')) {
    return 'invalid_grant';
  }
  if (message.includes('invalid_client')) {
    return 'invalid_client';
  }
  return null;
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
function oauthCookie(provider: string) {
  return `_external_oauth_${provider}`;
}
function readCookie(req: unknown, name: string): string | undefined {
  const header = (req as Request).headers?.cookie;
  const item = header
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${name}=`));
  return item?.slice(name.length + 1);
}
export function externalBrowserHash(
  req: unknown,
  tenantCode: string,
): string | undefined {
  const value = readCookie(req, `_interaction_${tenantCode}`);
  const signature = readCookie(req, `_interaction_${tenantCode}.sig`);
  return value && signature ? hash(`${value}\0${signature}`) : undefined;
}
function validExternalSubject(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 191 &&
    value !== 'undefined' &&
    value !== 'null' &&
    ![...value].some((character) => character.charCodeAt(0) <= 32)
  );
}
function minimumProfile(
  profile: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const nickname = profile?.nickname;
  return typeof nickname === 'string'
    ? { nickname: nickname.slice(0, 128) }
    : {};
}
