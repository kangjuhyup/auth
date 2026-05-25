import { Getter } from '../decorators';
import { PersistenceModel } from './persistence-model';

export const BUILT_IN_OIDC_SCOPES = ['openid', 'profile', 'email'] as const;

const SCOPE_TOKEN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;

interface ScopeModelProps {
  tenantId: string;
  name: string;
  displayName: string;
  description?: string | null;
  claimKeys: string[];
  enabled: boolean;
  builtIn: boolean;
}

export class ScopeModel extends PersistenceModel<string, ScopeModelProps> {
  constructor(props: ScopeModelProps, id?: string) {
    super(props, id);
  }

  @Getter()
  declare readonly tenantId: string;

  @Getter()
  declare readonly name: string;

  @Getter()
  declare readonly displayName: string;

  @Getter()
  declare readonly description: string | null | undefined;

  @Getter()
  declare readonly claimKeys: string[];

  @Getter()
  declare readonly enabled: boolean;

  @Getter()
  declare readonly builtIn: boolean;

  changeDisplayName(displayName: string): void {
    this.etc.displayName = displayName;
  }

  changeDescription(description: string | null): void {
    this.etc.description = description;
  }

  changeClaimKeys(claimKeys: string[]): void {
    this.etc.claimKeys = [...new Set(claimKeys)];
  }

  setEnabled(enabled: boolean): void {
    this.etc.enabled = enabled;
  }
}

export function parseScopeString(scope: string | undefined | null): string[] {
  const seen = new Set<string>();
  const scopes = (scope ?? '')
    .trim()
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return scopes.filter((item) => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

export function normalizeScopeString(scope: string): string {
  return parseScopeString(scope).join(' ');
}

export function isValidScopeToken(scope: string): boolean {
  return SCOPE_TOKEN_PATTERN.test(scope);
}
