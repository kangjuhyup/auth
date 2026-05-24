import type { TenantContext } from '@application/dto';

export type InteractionDetailsResult = Readonly<{
  uid: string;
  prompt: string;
  clientId: string;
  missingScopes: string[];
  mfaRequired: boolean;
  idpList: ReadonlyArray<{
    provider: string;
    name: string;
    protocol: string;
  }>;
}>;

export type InteractionCompletionResult = Readonly<{
  redirectTo: string;
}>;

export type InteractionJsonResult = Readonly<{
  status?: number;
  body: unknown;
}>;

export type InteractionRedirectResult = Readonly<{
  redirectTo: string;
}>;

export type InteractionXmlResult = Readonly<{
  contentType: string;
  body: string;
}>;

export type InteractionIdpRedirectResult =
  | InteractionJsonResult
  | InteractionRedirectResult;

export type InteractionIdpCallbackResult = InteractionRedirectResult;

export abstract class OidcInteractionPort {
  abstract getDetails(params: {
    tenantCode: string;
    uid: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }): Promise<InteractionDetailsResult>;

  abstract completeLogin(params: {
    tenantCode: string;
    req: unknown;
    res: unknown;
    userId: string;
  }): Promise<InteractionCompletionResult>;

  abstract completeConsent(params: {
    tenantCode: string;
    req: unknown;
    res: unknown;
  }): Promise<InteractionJsonResult | InteractionCompletionResult>;

  abstract abort(params: {
    tenantCode: string;
    req: unknown;
    res: unknown;
  }): Promise<InteractionCompletionResult>;

  abstract delegateProviderCallback(params: {
    tenantCode: string;
    req: unknown;
    res: unknown;
  }): Promise<unknown>;

  abstract getIdpRedirect(params: {
    tenantCode: string;
    uid: string;
    providerName: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }): Promise<InteractionIdpRedirectResult>;

  abstract handleIdpCallback(params: {
    tenantCode: string;
    uid: string;
    providerName: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }): Promise<InteractionIdpCallbackResult>;

  abstract getSamlMetadata(params: {
    tenantCode: string;
    providerName: string;
    req: unknown;
    tenant?: TenantContext;
  }): Promise<InteractionJsonResult | InteractionXmlResult>;

  abstract handleSamlCallback(params: {
    tenantCode: string;
    providerName: string;
    relayState?: string;
    samlResponse?: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }): Promise<InteractionJsonResult | InteractionRedirectResult>;
}
