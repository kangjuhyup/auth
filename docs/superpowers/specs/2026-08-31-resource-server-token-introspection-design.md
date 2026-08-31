# Resource Server Token Introspection Design

Date: 2026-08-31

## 1. Goal

Enable RFC 7662 token introspection through the tenant-scoped
`node-oidc-provider` instance, authenticate resource servers with existing
service clients, and publish a stable minimal response-claim contract.

The implementation must preserve these boundaries:

- `node-oidc-provider` owns the introspection endpoint, client authentication,
  token lookup, token lifecycle checks, and RFC error responses.
- Application and domain code own client lifecycle and the resource server's
  audience authorization data.
- Infrastructure callbacks bind the provider protocol to the tenant-scoped
  repositories and policies.
- No NestJS controller may reimplement token introspection.

## 2. Endpoint Contract

Keep the provider's standard route:

```text
POST /t/{tenantCode}/oidc/token/introspection
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(resourceServerClientId:resourceServerSecret)

token=<access-token>
token_type_hint=access_token  # optional
```

The issuer and discovery document remain tenant scoped:

```text
{OIDC_ISSUER_BASE}/t/{tenantCode}/oidc
```

Enabling `features.introspection` makes the provider advertise the standard
introspection endpoint. The route is not implemented or proxied by a custom
controller.

### 2.1 Access-token format boundary

The installed `oidc-provider` 9.6.0 implementation introspects opaque access
tokens and explicitly rejects structured JWT access tokens with
`unsupported_token_type`. This implementation preserves that provider-owned
behavior:

- `OIDC_ACCESS_TOKEN_FORMAT=opaque`: resource servers use the introspection
  endpoint and receive the response contract in this document.
- `OIDC_ACCESS_TOKEN_FORMAT=jwt`: resource servers validate the self-contained
  token locally against the tenant issuer and JWKS. The same `tenant_id` claim
  is issued in the JWT, but the JWT is not submitted to introspection.

Custom JWT parsing inside the authorization server, or a custom endpoint that
introspects JWTs, is explicitly out of scope because it would duplicate the
provider's token validation behavior. The deployed default and E2E environment
remain `opaque`.

## 3. Resource Server Identity

Reuse the existing client aggregate with `type: service` as the resource
server identity. A resource server eligible for introspection must be:

- registered in the same tenant as the provider instance;
- enabled;
- `type: service`;
- configured with `tokenEndpointAuthMethod: client_secret_basic`;
- provisioned with a secret;
- assigned at least one HTTPS audience in `introspectionResources`.

The provider authenticates the client before the introspection authorization
policy executes. Wrong, missing, or mismatched credentials return the
provider-owned `401 invalid_client` response.

`private_key_jwt` and mTLS are outside this change. They can be added later
without changing the audience authorization model.

## 4. Audience Authorization Model

Add the following client property:

```ts
introspectionResources: string[];
```

Its meaning is distinct from the existing `allowedResources` property:

| Property                 | Meaning                                                                     |
| ------------------------ | --------------------------------------------------------------------------- |
| `allowedResources`       | Resource Indicators for which this OAuth client may request an access token |
| `introspectionResources` | Access-token audiences this service client is authorized to introspect      |

Both fields contain normalized HTTPS origins. They must not be treated as
aliases or automatically copied into one another.

The provider `features.introspection.allowedPolicy` callback resolves the
authenticated caller from the tenant-scoped client repository and returns
`true` only when all of the following hold:

1. Request tenant context exists.
2. The caller exists, is enabled, and is a service client.
3. Its configured authentication method is `client_secret_basic`.
4. The token kind is `AccessToken` or `ClientCredentials`.
5. The token has an audience.
6. At least one token audience, normalized to an HTTPS origin, is present in
   the caller's `introspectionResources` allowlist.

Malformed or non-HTTPS token audiences fail closed. Refresh tokens are not
disclosed to resource servers. A validly authenticated but unauthorized caller
receives the indistinguishable inactive response rather than information about
the token.

Tenant isolation is enforced twice: the provider and client adapter are
tenant scoped, and the authorization policy queries the caller through the
request tenant ID. No cross-tenant fallback is allowed.

## 5. Claim Contract

Use the provider `extraTokenClaims` callback to attach the stable deployment
claim:

```json
{
  "tenant_id": "tenant-id"
}
```

This callback applies consistently to JWT access tokens and opaque access
tokens. For opaque tokens, the provider stores the value in token metadata and
returns it from introspection. Custom token signing or response assembly is not
introduced. For JWT tokens, the claim is consumed through local JWT validation,
not through the introspection endpoint.

### 5.1 Active user access token

The supported response subset is:

```json
{
  "active": true,
  "client_id": "web-client",
  "token_type": "Bearer",
  "scope": "openid profile",
  "iss": "https://auth.example.com/t/acme/oidc",
  "aud": "https://api.example.com",
  "exp": 1780000000,
  "iat": 1779996400,
  "tenant_id": "tenant-id",
  "sub": "user-id"
}
```

Required for active access tokens:

- `active`
- `client_id`
- `token_type`
- `iss`
- `aud`
- `exp`
- `iat`
- `tenant_id`

`scope` is required by the scoped user access-token example above, but remains
optional in the active response because a standard `client_credentials`
request may omit `scope` and the provider may omit the claim. `sub` is
required for user access tokens and absent for client-credentials tokens.
Provider-standard `jti`, `sid`, and `cnf` remain optional because they depend
on token format, session binding, and sender constraints.

The contract does not expose email, profile attributes, role assignments,
permissions, secrets, credentials, or internal policy state.

### 5.2 Inactive response

The following conditions return the same response:

```json
{
  "active": false
}
```

- unknown token;
- expired or revoked token;
- token from another tenant;
- token whose audience is not owned by the authenticated resource server;
- malformed or missing token audience;
- refresh token presented by a resource server.

No token metadata may be added to an inactive response.

### 5.3 Error responses

| Status | OAuth error              | Condition                                                                                    |
| ------ | ------------------------ | -------------------------------------------------------------------------------------------- |
| `400`  | `invalid_request`        | Required `token` parameter is absent or request syntax is invalid                            |
| `400`  | `unsupported_token_type` | A structured JWT access token is submitted to introspection                                  |
| `401`  | `invalid_client`         | Resource server credentials are absent, invalid, or use a method different from registration |
| `200`  | none                     | Authentication succeeded; token is active or indistinguishably inactive                      |

Tokens, client secrets, Basic authorization values, and full request bodies
must never be logged.

An `invalid_client` failure at the introspection endpoint emits the same
tenant-scoped security audit category used by token-endpoint client
authentication failures. The event records only the tenant, decoded client ID
when safely available, endpoint name, reason category, request/correlation ID,
IP, and user agent. It never records the presented secret, Authorization
header, or token parameter. Persisted text is bounded to the existing event
schema (`resource_id` 191, `user_agent` 255, `correlation_id` 128), and an IP
is retained only when it parses as an IPv4 or IPv6 address.

## 6. Application and Persistence Changes

Update the client model and existing client lifecycle instead of introducing a
new resource-server aggregate:

- `service/src/domain/models/client.ts`
- `service/src/application/dto/client.dto.ts`
- `service/src/application/commands/handlers/client-command.handler.ts`
- `service/src/application/queries/handlers/admin-query.handler.ts`
- `service/src/presentation/dto/admin/client.dto.ts`
- `service/src/presentation/openapi-response.ts`
- `service/src/infrastructure/repositories/mapper/client.mapper.ts`
- `service/src/infrastructure/mikro-orm/entities/client.ts`

Creation and update validation must reject:

- non-empty `introspectionResources` for non-service clients;
- non-HTTPS resource values;
- a service client with introspection resources but no secret;
- a service client with introspection resources and an authentication method
  other than `client_secret_basic`.

Add forward-only migrations for all supported database families:

- PostgreSQL
- MySQL
- Microsoft SQL Server

Each migration adds a non-null JSON-compatible `introspection_resources`
column and backfills existing clients with an empty array. The entity supplies
the empty-array default for new clients; PostgreSQL and SQL Server also retain
a database default. MySQL uses add/backfill/non-null steps instead of relying
on version-dependent JSON-column default-expression support. Existing migration
files are not modified.

## 7. Provider Integration

In `service/src/infrastructure/oidc-provider/oidc-provider.config.ts`:

- enable `features.introspection`;
- enable `features.clientCredentials` when the tenant grant registry includes
  `client_credentials`, so service-token issuance and introspection agree with
  the advertised supported grant contract;
- provide the fail-closed `allowedPolicy` callback;
- add `extraTokenClaims` with the current tenant ID;
- reuse the existing HTTPS resource normalization rules;
- keep the default `/token/introspection` provider route.

Extend the existing provider delegation observability so `invalid_client` at
`/token/introspection` is audited as an introspection authentication failure
without logging request credentials or token values.

The callback may depend on the injected tenant-scoped repository interfaces,
but domain and application code must not import `oidc-provider` types.

The existing `AccessVerifierAdapter` remains the internal authorization-server
adapter for NestJS bearer-protected endpoints. It is not used to implement the
public introspection endpoint and does not replace resource-server client
authentication.

## 8. OpenAPI and Documentation

Update the existing OpenAPI entry for
`/t/{tenantCode}/oidc/token/introspection` to describe:

- HTTP Basic resource-server authentication;
- the active response's required and optional claims;
- the exact inactive response contract;
- `400 invalid_request` and `401 invalid_client` outcomes;
- audience and tenant isolation behavior.

Regenerate `docs/static/openapi.json` through the repository's existing
generation command rather than editing the generated file manually.

## 9. Test Strategy

Follow TDD. Add failing tests before provider and model changes.

### Unit tests

- provider configuration enables introspection;
- active-policy allows an enabled service client for its registered audience;
- policy rejects public/confidential clients, disabled clients, wrong tenant,
  wrong audience, missing audience, non-HTTPS audience, and refresh tokens;
- `extraTokenClaims` emits only the stable tenant claim;
- create/update client validation enforces service type, Basic authentication,
  secret presence, and HTTPS audience values;
- mapper and query tests preserve `introspectionResources`.

### E2E tests

Using a real tenant-scoped provider:

1. Issue an access token with an allowed Resource Indicator.
2. Introspect it with the owning service client's Basic credentials.
3. Assert the full stable claim subset.
4. Assert client-credentials tokens omit `sub`.
5. Assert wrong secret and unauthenticated calls return `401`.
6. Assert public clients cannot authenticate for introspection.
7. Assert a service client for another audience receives only
   `{ "active": false }`.
8. Assert a same-client resource server in another tenant cannot inspect the
   token.
9. Assert unknown, expired/revoked, and refresh tokens return only the inactive
   response.
10. Run the E2E contract for the configured opaque access-token format; add a
    focused provider test proving `tenant_id` is also issued for JWT format and
    that JWT introspection preserves the provider's `unsupported_token_type`
    response.

Security-sensitive branches require full branch coverage in the policy helper.
No test may log raw tokens or client secrets.

## 10. Alternatives Considered

### Reuse `allowedResources` for introspection

Rejected because it conflates a client being allowed to request a token for an
API with a resource server being allowed to inspect tokens addressed to that
API. The direction of authorization is different and accidental privilege
expansion would be difficult to audit.

### Create a dedicated resource-server aggregate and table

Deferred because resource servers already need the provider's OAuth client
authentication machinery. A separate credential model would either duplicate
client authentication or require a custom introspection endpoint, both of
which violate the provider ownership boundary. A dedicated aggregate can be
introduced later if resource-server lifecycle requirements diverge materially
from service-client lifecycle.

### Implement introspection in a NestJS controller

Rejected because it would duplicate RFC token parsing, client authentication,
token validity checks, and response behavior already implemented by
`node-oidc-provider`.

## 11. Acceptance Criteria

- Discovery advertises the tenant-scoped standard introspection endpoint.
- Provider client-credentials support is synchronized with the tenant grant
  registry, and introspected client-credentials tokens omit `sub`.
- Opaque access tokens follow the introspection contract, while JWT access
  tokens retain provider-owned `unsupported_token_type` behavior and carry the
  same `tenant_id` claim for local validation.
- Only authenticated service clients with an explicitly registered audience
  can receive an active response.
- Cross-audience and cross-tenant probes are indistinguishably inactive.
- The documented stable claim subset is present for active access tokens;
  `scope` is present for scoped user tokens and optional for scope-less
  client-credentials tokens.
- No sensitive user attributes or credentials appear in introspection output or
  logs.
- Introspection `invalid_client` failures emit redacted, tenant-scoped security
  audit events.
- Existing OIDC authorization, token, userinfo, revocation, SSO, and SLO tests
  continue to pass.
- PostgreSQL, MySQL, and Microsoft SQL Server schemas all receive the new
  forward-only column migration.
