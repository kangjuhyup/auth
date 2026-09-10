---
title: External Hosted Interaction UI
description: Per-client UI delegation, browser contract, exact-origin CORS, CSRF, and interaction states
---

# External Hosted Interaction UI

Auth neither knows consumer-service domain contracts nor calls consumer servers. An external Hosted UI only renders screens and collects user input. Auth retains ownership of the OIDC interaction, credentials, MFA, consent, and token issuance. The UI must not access the Auth database or Admin API. Passwords must be submitted directly from the browser to the Auth interaction API, never through a consumer application server.

## Admin configuration

Set `External Hosted UI URL` on the Admin Clients screen or use the Admin API:

```http
PUT /t/{tenantCode}/admin/clients/{clientRefId}
Content-Type: application/json

{
  "externalInteractionUiUrl": "https://login.example.com/interaction"
}
```

Read responses include `externalInteractionUiUrl: string | null`. Updating it to `null` removes delegation and restores the built-in UI.

The URL must be absolute HTTPS. User information, fragments, and wildcard hosts are forbidden. Paths and query parameters are allowed, but Auth overwrites `tenantCode` and `uid`. HTTP loopback is accepted only for `localhost`, `127.0.0.1`, or `[::1]` when `NODE_ENV !== production` and `EXTERNAL_INTERACTION_UI_ALLOW_HTTP_LOCALHOST=true`.

## Browser bootstrap

The provider interaction URL remains on the Auth origin:

```text
GET https://auth.example.com/t/{tenantCode}/interaction/{uid}
```

After validating the provider interaction cookie and stored client binding, Auth returns a `303` redirect:

```text
Location: https://login.example.com/interaction
  ?tenantCode=acme
  &uid=interaction-uid
  #interaction_token=<short-lived-signed-token>&csrf_token=<random-token>
```

Only `tenantCode` and `uid` are added to the query. `redirect_uri`, `state`, the PKCE challenge, and the original authorization request remain inside the node-oidc-provider interaction session and cannot be owned or changed by the external UI.

On first render, read the fragment into memory and immediately remove it with `history.replaceState`. Never put fragment credentials in logs, analytics, error reports, storage, cookies, or server requests.

```ts
const page = new URL(window.location.href);
const tenantCode = page.searchParams.get('tenantCode');
const uid = page.searchParams.get('uid');
const fragment = new URLSearchParams(page.hash.slice(1));
const interactionToken = fragment.get('interaction_token');
const csrfToken = fragment.get('csrf_token');
history.replaceState(null, '', `${page.pathname}${page.search}`);
```

## Interaction API contract

The API base is on the Auth origin, not the external UI origin:

```text
https://auth.example.com/t/{tenantCode}/interaction/{uid}
```

Every `/api` call uses credentialed CORS and both credentials:

```ts
const response = await fetch(`${authBase}/api/details`, {
  method: 'GET',
  mode: 'cors',
  credentials: 'include',
  headers: {
    Authorization: `Bearer ${interactionToken}`,
    'X-Interaction-CSRF': csrfToken,
  },
});
```

JSON writes also set `Content-Type: application/json`. Auth allows credentials only for the exact origin derived from the client URL. Wildcards, sibling subdomains, different ports, and different schemes are rejected.

| Method | Path                        | Request body                           | Main response                                                    |
| ------ | --------------------------- | -------------------------------------- | ---------------------------------------------------------------- |
| `GET`  | `/api/details`              | none                                   | `{ uid, prompt, clientId, missingScopes, mfaRequired, idpList }` |
| `POST` | `/api/login`                | `{ username, password }`               | next-step flags and `methods`, or `redirectTo`                   |
| `POST` | `/api/password-change`      | `{ currentPassword, newPassword }`     | MFA next step or `redirectTo`                                    |
| `GET`  | `/api/mfa/webauthn-options` | none                                   | WebAuthn options                                                 |
| `POST` | `/api/mfa`                  | `{ method, code?, webauthnResponse? }` | `redirectTo` on completion                                       |
| `POST` | `/api/mfa/totp/enroll`      | none                                   | `{ success, secret, otpauthUrl }`                                |
| `POST` | `/api/mfa/totp/confirm`     | `{ code }`                             | `{ success, recoveryCodes, redirectTo? }`                        |
| `POST` | `/api/consent`              | none                                   | `{ success, redirectTo }`                                        |
| `POST` | `/api/abort`                | none                                   | `{ redirectTo }`                                                 |

For an external IdP, render only entries returned in `idpList` and perform a top-level navigation to `https://auth.example.com/t/{tenantCode}/interaction/{uid}/idp/{provider}`. Do not invent provider keys.

## State transitions

```text
OIDC authorization
  -> Auth interaction bootstrap
  -> external UI details
  -> login
     -> password change -> login completion
     -> MFA enrollment -> MFA completion
     -> MFA -> login completion
     -> login completion
  -> consent -> consent completion
  -> Auth resume URL
  -> node-oidc-provider redirects to the validated redirect_uri
```

Auth returns only same-Auth-origin resume URLs in `redirectTo`. The UI must not construct this value or accept a `returnTo`; it uses the successful response as a top-level navigation target.

## Security and failure behavior

- The short-lived signed access token binds tenant ID/code, client ID, uid, exact origin, CSRF hash, browser-binding hash, jti, and expiry.
- A separate HttpOnly browser binding and the provider interaction cookies are reissued only on that interaction path with `SameSite=None; Secure` for an HTTPS external UI.
- Redis stores hashes and bindings with TTL, never the raw access token, CSRF token, or browser binding.
- A new bootstrap replaces the previous jti. A terminal operation atomically consumes access through EVAL before provider completion, so only one concurrent replay reaches completion.
- Tenant/client/uid/origin mismatch, tampering, CSRF/browser mismatch, expiry, and replay return a generic `403` without credential details.
- `401` may indicate invalid login or MFA input; `400` indicates invalid input or missing flow state. After `403` or expiry, discard the fragment and restart OIDC authorization from the consumer application.
- Deploy the external UI with HTTPS, `Referrer-Policy: no-referrer`, a strict CSP, and credential-redaction rules.

## Deployment and migration

1. Apply `Migration20260911000000` before deploying the new image; it adds nullable `client.external_interaction_ui_url`.
2. Set `EXTERNAL_INTERACTION_ACCESS_TTL_SEC` to 60–600 seconds; the default is 300.
3. Keep `EXTERNAL_INTERACTION_UI_ALLOW_HTTP_LOCALHOST=false` in production.
4. Verify credentialed CORS and cross-site cookies with target browsers. Prefer same-site deployment where third-party-cookie policy blocks this flow.
5. Enable one client at a time and regress Authorization Code + PKCE, MFA, consent, and abort.

Clients without the setting continue to use the built-in Interaction UI.
