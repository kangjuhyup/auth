import type { ApplicationType, ClientType } from '@domain/models/client';

export type GrantTypeName =
  | 'authorization_code'
  | 'refresh_token'
  | 'client_credentials'
  | 'implicit'
  | (string & {});

export interface GrantTypeDefinition {
  grantType: GrantTypeName;
  displayName: string;
  builtIn: boolean;
  enabled: boolean;
  allowedClientTypes: ClientType[];
  allowedApplicationTypes: ApplicationType[];
  requiresClientAuthentication: boolean;
  requiresGrantTypes?: GrantTypeName[];
}

export interface GrantTypeValidationParams {
  tenantId: string;
  clientType: ClientType;
  applicationType: ApplicationType;
  tokenEndpointAuthMethod: string;
  grantTypes: string[];
}

export type GrantTypeValidationIssueReason =
  | 'unsupported'
  | 'disabled'
  | 'client_type_not_allowed'
  | 'application_type_not_allowed'
  | 'client_auth_required'
  | 'required_grant_missing';

export interface GrantTypeValidationIssue {
  grantType: string;
  reason: GrantTypeValidationIssueReason;
  requiredGrantType?: string;
}

export abstract class GrantTypeRegistryPort {
  abstract listSupportedGrantTypes(): Promise<string[]>;
  abstract listDefinitions(): Promise<GrantTypeDefinition[]>;
  abstract validateClientGrantTypes(
    params: GrantTypeValidationParams,
  ): Promise<GrantTypeValidationIssue[]>;
}
