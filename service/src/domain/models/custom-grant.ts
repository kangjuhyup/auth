import { Getter } from '../decorators';
import { PersistenceModel } from './persistence-model';
import type { ApplicationType, ClientType } from './client';

const CUSTOM_GRANT_TYPE_PATTERN = /^urn:[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,187}$/;

interface CustomGrantModelProps {
  tenantId: string;
  grantType: string;
  displayName: string;
  description?: string | null;
  enabled: boolean;
  allowedClientTypes: ClientType[];
  allowedApplicationTypes: ApplicationType[];
  requiresClientAuthentication: boolean;
  requiresGrantTypes: string[];
  builtIn: boolean;
}

export class CustomGrantModel extends PersistenceModel<
  string,
  CustomGrantModelProps
> {
  constructor(props: CustomGrantModelProps, id?: string) {
    super(props, id);
  }

  @Getter()
  declare readonly tenantId: string;

  @Getter()
  declare readonly grantType: string;

  @Getter()
  declare readonly displayName: string;

  @Getter()
  declare readonly description: string | null | undefined;

  @Getter()
  declare readonly enabled: boolean;

  @Getter()
  declare readonly allowedClientTypes: ClientType[];

  @Getter()
  declare readonly allowedApplicationTypes: ApplicationType[];

  @Getter()
  declare readonly requiresClientAuthentication: boolean;

  @Getter()
  declare readonly requiresGrantTypes: string[];

  @Getter()
  declare readonly builtIn: boolean;

  changeDisplayName(displayName: string): void {
    this.etc.displayName = displayName;
  }

  changeDescription(description: string | null): void {
    this.etc.description = description;
  }

  setEnabled(enabled: boolean): void {
    this.etc.enabled = enabled;
  }

  changeAllowedClientTypes(types: ClientType[]): void {
    this.etc.allowedClientTypes = [...new Set(types)];
  }

  changeAllowedApplicationTypes(types: ApplicationType[]): void {
    this.etc.allowedApplicationTypes = [...new Set(types)];
  }

  changeRequiresClientAuthentication(value: boolean): void {
    this.etc.requiresClientAuthentication = value;
  }

  changeRequiresGrantTypes(types: string[]): void {
    this.etc.requiresGrantTypes = [...new Set(types)];
  }
}

export function isValidCustomGrantType(grantType: string): boolean {
  return CUSTOM_GRANT_TYPE_PATTERN.test(grantType);
}
