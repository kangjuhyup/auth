type OpenApiOperation = {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: unknown[];
  requestBody?: unknown;
  responses?: Record<string, unknown>;
  security?: Record<string, string[]>[];
  [key: string]: unknown;
};

type OpenApiPathItem = {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  delete?: OpenApiOperation;
  patch?: OpenApiOperation;
  [key: string]: unknown;
};

export type OpenApiDocument = {
  tags?: { name: string; description?: string }[];
  paths: Record<string, any>;
};

const TENANT_CODE_PARAMETER = {
  name: 'tenantCode',
  in: 'path',
  required: true,
  schema: { type: 'string', example: 'acme' },
  description: 'Tenant code bound to the OIDC issuer.',
};

const OAUTH_ERROR_RESPONSE = {
  description:
    'OAuth/OIDC error response. Internal stack traces are never exposed.',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'invalid_request' },
          error_description: {
            type: 'string',
            example: 'The request is missing a required parameter.',
          },
        },
      },
    },
  },
};

const OIDC_TAG = {
  name: 'OIDC Protocol',
  description:
    'Tenant-scoped OAuth2/OIDC endpoints delegated to node-oidc-provider. Protocol validation, PKCE, token issuance, sessions, grants, and replay protection are handled by the provider.',
};

const ENDPOINT_DESCRIPTIONS: Array<{
  pattern: RegExp;
  description: string;
}> = [
  {
    pattern: /^\/health$/,
    description:
      'Process liveness check. Used by runtime health probes and does not expose sensitive state.',
  },
  {
    pattern: /^\/ready$/,
    description:
      'Readiness check for database, Redis, JWKS configuration, and OIDC provider registry.',
  },
  {
    pattern: /^\/metrics$/,
    description:
      'Operational metrics for provider cache, login attempts, token endpoint activity, and related runtime counters.',
  },
  {
    pattern: /^\/t\/\{tenantCode\}\/admin\/clients/,
    description:
      'Client lifecycle management. Redirect URIs are strictly validated, grant types are checked against policy, client secrets are never returned, and changes are audited.',
  },
  {
    pattern: /^\/t\/\{tenantCode\}\/admin\/keys/,
    description:
      'JWKS signing key operations. Key rotation keeps overlap for existing tokens, never exposes private key material, records rotation events, and invalidates JWKS cache.',
  },
  {
    pattern: /^\/t\/\{tenantCode\}\/admin\/policies/,
    description:
      'Tenant policy management. Policy changes are audited and security-sensitive controls such as PKCE, MFA, session, refresh-token, and signup behavior must remain policy-driven.',
  },
  {
    pattern: /^\/t\/\{tenantCode\}\/admin\/audit-logs/,
    description:
      'Read-only audit log access. Results are RBAC-protected and must not contain tokens, secrets, password hashes, or raw key material.',
  },
  {
    pattern: /^\/t\/\{tenantCode\}\/admin\/tenants/,
    description:
      'Tenant lifecycle management. Tenant codes are immutable after creation, destructive changes must check dependent resources, and changes are audited.',
  },
  {
    pattern: /^\/t\/\{tenantCode\}\/admin\/users/,
    description:
      'User management. Passwords are hashed, sensitive credentials are not returned, status changes are audited, and personally identifiable data is kept minimal.',
  },
  {
    pattern: /^\/t\/\{tenantCode\}\/admin\/roles/,
    description:
      'Role management. Role codes are tenant-unique, deletion must account for assignments, inheritance must not form cycles, and changes are audited.',
  },
  {
    pattern: /^\/t\/\{tenantCode\}\/admin\/permissions/,
    description:
      'Permission management. Permission codes are tenant-unique, role associations must be considered before deletion, and changes are audited.',
  },
  {
    pattern: /^\/t\/\{tenantCode\}\/admin\/groups/,
    description:
      'Group management. Group codes are tenant-unique, hierarchy cycles are forbidden, child groups are checked before deletion, and changes are audited.',
  },
  {
    pattern: /^\/auth\/signup$/,
    description:
      'User signup. Tenant signup policy is enforced, passwords are hashed, duplicates are rejected, rate limiting applies, and signup activity is audited.',
  },
  {
    pattern: /^\/auth\/withdraw$/,
    description:
      'Authenticated self-service account withdrawal. The caller must be authenticated; related sessions, tokens, consents, and audit records are handled by application policy.',
  },
  {
    pattern: /^\/auth\/password$/,
    description:
      'Authenticated password change. Current password is verified, the new password must be different, password policy is enforced, and the change is audited.',
  },
  {
    pattern: /^\/auth\/password\/reset-request$/,
    description:
      'Password reset request. Responses must avoid user enumeration, apply strong rate limiting, use short-lived one-time reset tokens, and emit security audit events.',
  },
  {
    pattern: /^\/auth\/password\/reset$/,
    description:
      'Token-based password reset. Reset tokens are one-time and short-lived; successful reset revokes relevant sessions or tokens according to policy.',
  },
  {
    pattern: /^\/auth\/consents/,
    description:
      'Authenticated consent self-service. Users can list and revoke only their own client consents; revocation invalidates related refresh-token access according to policy.',
  },
  {
    pattern: /^\/auth\/profile$/,
    description:
      'Authenticated profile self-service. Password hashes, credential secrets, raw MFA material, and internal system fields are never exposed.',
  },
];

export function applyEndpointReference(document: OpenApiDocument): void {
  mergeTags(document);
  mergeOidcProviderPaths(document);
  appendEndpointDescriptions(document);
}

function mergeTags(document: OpenApiDocument): void {
  const tags = document.tags ?? [];
  if (!tags.some((tag) => tag.name === OIDC_TAG.name)) {
    tags.push(OIDC_TAG);
  }
  document.tags = tags;
}

function mergeOidcProviderPaths(document: OpenApiDocument): void {
  Object.assign(document.paths, {
    '/t/{tenantCode}/oidc/.well-known/openid-configuration': {
      get: oidcOperation({
        summary: 'OIDC discovery metadata',
        description:
          'Returns tenant issuer metadata for client auto-configuration, including authorization, token, JWKS, scopes, response types, and supported grant types. Public endpoint; short TTL caching is acceptable and configuration changes should invalidate caches.',
        responses: {
          '200': {
            description: 'OIDC discovery document',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: [
                    'issuer',
                    'authorization_endpoint',
                    'token_endpoint',
                    'jwks_uri',
                    'scopes_supported',
                    'response_types_supported',
                    'grant_types_supported',
                  ],
                  properties: {
                    issuer: {
                      type: 'string',
                      example: 'http://localhost:3000/t/acme/oidc',
                    },
                    authorization_endpoint: { type: 'string' },
                    token_endpoint: { type: 'string' },
                    jwks_uri: { type: 'string' },
                    scopes_supported: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    response_types_supported: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    grant_types_supported: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    },
    '/t/{tenantCode}/oidc/auth': {
      get: oidcOperation({
        summary: 'Authorization endpoint',
        description:
          'Starts user authentication and authorization. Redirect URI must match exactly, PKCE is required with S256, state and nonce are required, open redirects are rejected, and full query parameters must not be logged.',
        parameters: [
          parameter('client_id', 'Registered client identifier'),
          parameter('redirect_uri', 'Exact registered redirect URI'),
          parameter('response_type', 'OAuth response type', 'code'),
          parameter(
            'scope',
            'Requested scopes including openid',
            'openid profile email',
          ),
          parameter('state', 'Opaque CSRF binding value'),
          parameter('nonce', 'OIDC replay protection value'),
          parameter('code_challenge', 'PKCE code challenge'),
          parameter('code_challenge_method', 'PKCE method; S256 only', 'S256'),
        ],
        responses: {
          '302': {
            description: 'Redirect to interaction UI or client redirect URI',
            headers: {
              Location: {
                description: 'Redirect target',
                schema: { type: 'string' },
              },
            },
          },
          '400': OAUTH_ERROR_RESPONSE,
        },
      }),
    },
    '/t/{tenantCode}/oidc/token': {
      post: oidcOperation({
        summary: 'Token endpoint',
        description:
          'Exchanges authorization codes, refresh tokens, client credentials, or registered custom grants for tokens. Confidential clients must authenticate, public clients use PKCE, authorization codes are one-time and short-lived, refresh token rotation and reuse detection are enforced, and tokens or secrets must never be logged.',
        requestBody: {
          required: true,
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                type: 'object',
                required: ['grant_type'],
                properties: {
                  grant_type: {
                    type: 'string',
                    example: 'authorization_code',
                  },
                  code: { type: 'string' },
                  redirect_uri: { type: 'string' },
                  client_id: { type: 'string' },
                  code_verifier: { type: 'string' },
                  refresh_token: { type: 'string' },
                  client_secret: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Token response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['access_token', 'token_type', 'expires_in'],
                  properties: {
                    access_token: { type: 'string' },
                    id_token: { type: 'string' },
                    refresh_token: { type: 'string' },
                    expires_in: { type: 'integer', example: 3600 },
                    token_type: { type: 'string', example: 'Bearer' },
                  },
                },
              },
            },
          },
          '400': OAUTH_ERROR_RESPONSE,
          '401': OAUTH_ERROR_RESPONSE,
        },
      }),
    },
    '/t/{tenantCode}/oidc/jwks': {
      get: oidcOperation({
        summary: 'JWKS endpoint',
        description:
          'Returns public signing keys for token verification. Active and overlap-window previous keys may be returned; private key material is never exposed and each key includes a kid.',
        responses: {
          '200': {
            description: 'JSON Web Key Set',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['keys'],
                  properties: {
                    keys: {
                      type: 'array',
                      items: { type: 'object', additionalProperties: true },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    },
    '/t/{tenantCode}/oidc/me': {
      get: oidcOperation({
        summary: 'UserInfo endpoint',
        description:
          'Returns scope-filtered user claims for a valid access token. Only minimal user information is exposed and bearer tokens must not be logged.',
        security: [{ 'access-token': [] }],
        responses: {
          '200': {
            description: 'UserInfo claims',
            content: {
              'application/json': {
                schema: { type: 'object', additionalProperties: true },
              },
            },
          },
          '401': OAUTH_ERROR_RESPONSE,
        },
      }),
    },
    '/t/{tenantCode}/oidc/session/end': {
      get: oidcOperation({
        summary: 'End session endpoint',
        description:
          'Terminates the provider session and processes RP-initiated logout. id_token_hint and post_logout_redirect_uri are validated to prevent open redirects.',
        parameters: [
          parameter('id_token_hint', 'ID token hint', undefined, false),
          parameter(
            'post_logout_redirect_uri',
            'Registered post logout redirect URI',
            undefined,
            false,
          ),
          parameter('state', 'Opaque client state', undefined, false),
        ],
        responses: {
          '302': {
            description: 'Redirect after logout',
          },
          '400': OAUTH_ERROR_RESPONSE,
        },
      }),
    },
    '/t/{tenantCode}/oidc/token/revocation': {
      post: oidcOperation({
        summary: 'Token revocation endpoint',
        description:
          'Revokes access or refresh tokens. Client authentication is required where applicable, refresh-token family revocation is supported by policy, and revocation events are audited.',
        requestBody: tokenRequestBody(['token']),
        responses: {
          '200': { description: 'Token revocation accepted' },
          '401': OAUTH_ERROR_RESPONSE,
        },
      }),
    },
    '/t/{tenantCode}/oidc/token/introspection': {
      post: oidcOperation({
        summary: 'Token introspection endpoint',
        description:
          'Allows authorized resource servers or clients to inspect token activity. Client authentication is required and inactive tokens do not reveal sensitive internals.',
        requestBody: tokenRequestBody(['token']),
        responses: {
          '200': {
            description: 'Token introspection response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['active'],
                  properties: {
                    active: { type: 'boolean', example: true },
                    sub: { type: 'string' },
                    client_id: { type: 'string' },
                    scope: { type: 'string' },
                    exp: { type: 'integer' },
                  },
                },
              },
            },
          },
          '401': OAUTH_ERROR_RESPONSE,
        },
      }),
    },
    '/t/{tenantCode}/oidc/request': {
      post: oidcOperation({
        summary: 'Pushed authorization request endpoint',
        description:
          'Registers sensitive authorization request parameters before redirecting the user. Client authentication is required when applicable and request URIs are short-lived.',
        requestBody: {
          required: true,
          content: {
            'application/x-www-form-urlencoded': {
              schema: { type: 'object', additionalProperties: true },
            },
          },
        },
        responses: {
          '201': {
            description: 'Pushed authorization request registered',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    request_uri: { type: 'string' },
                    expires_in: { type: 'integer', example: 60 },
                  },
                },
              },
            },
          },
          '400': OAUTH_ERROR_RESPONSE,
          '401': OAUTH_ERROR_RESPONSE,
        },
      }),
    },
  });
}

function appendEndpointDescriptions(document: OpenApiDocument): void {
  for (const [path, pathItem] of Object.entries(document.paths)) {
    if (!pathItem) continue;
    const description = ENDPOINT_DESCRIPTIONS.find((entry) =>
      entry.pattern.test(path),
    )?.description;
    if (!description) continue;

    for (const operation of operations(pathItem)) {
      operation.description = mergeDescription(
        operation.description,
        description,
      );
    }
  }
}

function operations(pathItem: OpenApiPathItem): OpenApiOperation[] {
  return ['get', 'post', 'put', 'delete', 'patch']
    .map((method) => pathItem[method])
    .filter((operation): operation is OpenApiOperation => Boolean(operation));
}

function mergeDescription(
  current: string | undefined,
  addition: string,
): string {
  if (!current) return addition;
  if (current.includes(addition)) return current;
  return `${current}\n\n${addition}`;
}

function oidcOperation(params: {
  summary: string;
  description: string;
  parameters?: unknown[];
  requestBody?: unknown;
  responses: Record<string, unknown>;
  security?: Record<string, string[]>[];
}): OpenApiOperation {
  return {
    tags: [OIDC_TAG.name],
    summary: params.summary,
    description: params.description,
    parameters: [TENANT_CODE_PARAMETER, ...(params.parameters ?? [])],
    ...(params.requestBody ? { requestBody: params.requestBody } : {}),
    ...(params.security ? { security: params.security } : {}),
    responses: params.responses,
    'x-provider-managed': 'node-oidc-provider',
  };
}

function parameter(
  name: string,
  description: string,
  example?: string,
  required = true,
) {
  return {
    name,
    in: 'query',
    required,
    schema: { type: 'string', ...(example ? { example } : {}) },
    description,
  };
}

function tokenRequestBody(required: string[]) {
  return {
    required: true,
    content: {
      'application/x-www-form-urlencoded': {
        schema: {
          type: 'object',
          required,
          properties: {
            token: { type: 'string' },
            token_type_hint: { type: 'string', example: 'refresh_token' },
            client_id: { type: 'string' },
            client_secret: { type: 'string' },
          },
        },
      },
    },
  };
}
