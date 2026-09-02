// Request URLs and names can contain OIDC state, nonce, and PKCE parameters.
// Keep two fixed dimensions so the k6 option is explicit; custom load metrics
// supply the endpoint/minute dimensions needed for capacity classification.
export const SAFE_SYSTEM_TAGS = Object.freeze(['status', 'method']);
