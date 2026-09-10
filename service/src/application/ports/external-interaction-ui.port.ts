import type { TenantContext } from '@application/dto';
import type { ExternalInteractionAccessClaims } from './external-interaction-access.port';

export type ExternalInteractionUiDecision =
  | Readonly<{ mode: 'embedded' }>
  | Readonly<{
      mode: 'external';
      redirectTo: string;
      browserBinding: string;
      maxAgeMs: number;
      secureCookies: boolean;
    }>;

export type ExternalInteractionAuthorization =
  | Readonly<{ mode: 'embedded' }>
  | Readonly<{
      mode: 'external';
      access: ExternalInteractionAccessClaims;
    }>;

export abstract class ExternalInteractionUiPort {
  abstract prepare(params: {
    tenantCode: string;
    uid: string;
    req: unknown;
    res: unknown;
    tenant?: TenantContext;
  }): Promise<ExternalInteractionUiDecision>;

  abstract resolveCorsOrigin(params: {
    tenantCode: string;
    uid: string;
  }): Promise<string | null>;

  abstract authorize(params: {
    tenantCode: string;
    uid: string;
    origin?: string;
    accessToken?: string;
    csrfToken?: string;
    browserBinding?: string;
  }): Promise<ExternalInteractionAuthorization>;

  abstract consume(params: {
    tenantCode: string;
    uid: string;
    accessId: string;
  }): Promise<boolean>;
}
