export interface CreateScopeDto {
  name: string;
  displayName?: string;
  description?: string | null;
  claimKeys?: string[];
  enabled?: boolean;
}

export interface UpdateScopeDto {
  displayName?: string;
  description?: string | null;
  claimKeys?: string[];
  enabled?: boolean;
}

export interface ScopeResponse {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  claimKeys: string[];
  enabled: boolean;
  builtIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}
