export interface ScopeDefinition {
  scope: string;
  displayName: string;
  claimKeys: string[];
  builtIn: boolean;
  enabled: boolean;
}

export interface ScopeValidationParams {
  tenantId: string;
  scopes: string[];
}

export type ScopeValidationIssueReason =
  | 'empty'
  | 'invalid_format'
  | 'unsupported'
  | 'disabled';

export interface ScopeValidationIssue {
  scope: string;
  reason: ScopeValidationIssueReason;
}

export abstract class ScopeRegistryPort {
  abstract listSupportedScopes(tenantId?: string): Promise<string[]>;
  abstract listDefinitions(tenantId?: string): Promise<ScopeDefinition[]>;
  abstract validateClientScopes(
    params: ScopeValidationParams,
  ): Promise<ScopeValidationIssue[]>;
}
