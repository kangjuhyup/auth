import type { TenantContext } from '@application/dto';
import type {
  InteractionDetailsResult,
  InteractionIdpCallbackResult,
  InteractionIdpRedirectResult,
  InteractionJsonResult,
  InteractionRedirectResult,
  InteractionXmlResult,
} from './oidc-interaction.port';

export type InteractionResponse = Readonly<{
  status?: number;
  body: unknown;
}>;

export type InteractionMfaMethod = 'totp' | 'webauthn' | 'recovery_code';

export abstract class InteractionCommandPort {
  abstract getDetails(params: {
    tenantCode: string;
    uid: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }): Promise<InteractionDetailsResult>;

  abstract submitLogin(params: {
    tenantCode: string;
    uid: string;
    username: string;
    password: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }): Promise<InteractionResponse>;

  abstract submitMfa(params: {
    tenantCode: string;
    uid: string;
    method: InteractionMfaMethod;
    code?: string;
    webauthnResponse?: Record<string, unknown>;
    req: unknown;
    res: unknown;
    rpId: string;
    expectedOrigin: string;
  }): Promise<InteractionResponse>;

  abstract submitConsent(params: {
    tenantCode: string;
    req: unknown;
    res: unknown;
  }): Promise<InteractionJsonResult | InteractionRedirectResult>;

  abstract abort(params: {
    tenantCode: string;
    req: unknown;
    res: unknown;
  }): Promise<InteractionRedirectResult>;

  abstract getWebAuthnOptions(params: {
    uid: string;
    rpId: string;
    expectedOrigin: string;
  }): Promise<InteractionResponse>;

  abstract getIdpRedirect(params: {
    tenantCode: string;
    uid: string;
    providerName: string;
    req: unknown;
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
