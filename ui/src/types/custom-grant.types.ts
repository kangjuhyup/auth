export type ClientType = 'confidential' | 'public' | 'service';
export type ApplicationType = 'web' | 'native';

export interface CreateCustomGrantDto {
  grantType: string;
  displayName?: string;
  description?: string | null;
  enabled?: boolean;
  allowedClientTypes?: ClientType[];
  allowedApplicationTypes?: ApplicationType[];
  requiresClientAuthentication?: boolean;
  requiresGrantTypes?: string[];
}

export interface UpdateCustomGrantDto {
  displayName?: string;
  description?: string | null;
  enabled?: boolean;
  allowedClientTypes?: ClientType[];
  allowedApplicationTypes?: ApplicationType[];
  requiresClientAuthentication?: boolean;
  requiresGrantTypes?: string[];
}

export interface CustomGrantResponse {
  id: string;
  grantType: string;
  displayName: string;
  description: string | null;
  enabled: boolean;
  allowedClientTypes: ClientType[];
  allowedApplicationTypes: ApplicationType[];
  requiresClientAuthentication: boolean;
  requiresGrantTypes: string[];
  builtIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}
