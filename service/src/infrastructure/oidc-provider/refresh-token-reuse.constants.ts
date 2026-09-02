export const REFRESH_TOKEN_REUSE_CONFLICT_KIND = 'RefreshTokenReuseConflict';
export const REFRESH_TOKEN_REUSE_GRANT_CONFLICT_KIND =
  'RefreshTokenReuseGrantConflict';
export const REFRESH_TOKEN_REUSE_AUDIT_KIND = 'RefreshTokenReuseAudit';
export const REFRESH_TOKEN_REUSE_CLEANUP_KIND = 'RefreshTokenReuseCleanup';
export const REFRESH_TOKEN_REUSE_COORDINATION_TTL_SEC = 60;

export const OIDC_GRANT_BOUND_KINDS = [
  'AccessToken',
  'AuthorizationCode',
  'RefreshToken',
  'DeviceCode',
  'BackchannelAuthenticationRequest',
  'ClientCredentials',
] as const;

export function redisRefreshTokenReuseConflictKey(
  tenantId: string,
  tokenId: string,
): string {
  return `oidc:${tenantId}:reuse-conflict:${tokenId}`;
}

export function redisRefreshTokenReuseGrantConflictKey(
  tenantId: string,
  grantId: string,
): string {
  return `oidc:${tenantId}:reuse-conflict:grant:${grantId}`;
}

export function redisRefreshTokenReuseAuditKey(
  tenantId: string,
  tokenId: string,
): string {
  return `oidc:${tenantId}:reuse-audit:${tokenId}`;
}

export function redisRefreshTokenReuseCleanupKey(
  tenantId: string,
  grantId: string,
): string {
  return `oidc:${tenantId}:reuse-cleanup:${grantId}`;
}
