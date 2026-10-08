import { createHash } from 'node:crypto';
import type { KoaContextWithOIDC } from 'oidc-provider';

type LogoutSource = (ctx: KoaContextWithOIDC, form: string) => Promise<void>;

export function createRpInitiatedLogoutSource(params: {
  tenantId: string;
}): LogoutSource {
  return async (ctx, form) => {
    ctx.type = 'html';
    ctx.status = 200;
    ctx.set('Cache-Control', 'no-store');
    ctx.set('Referrer-Policy', 'no-referrer');

    if (isCurrentRpSessionLogout(ctx, params.tenantId)) {
      const script = buildAutoSubmitScript();
      const scriptHash = createHash('sha256').update(script).digest('base64');
      ctx.set(
        'Content-Security-Policy',
        `default-src 'none'; script-src 'sha256-${scriptHash}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
      );
      ctx.body = renderAutoSubmitPage(form, script);
      return;
    }

    ctx.set(
      'Content-Security-Policy',
      "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    );
    ctx.body = renderConfirmationPage(form);
  };
}

function isCurrentRpSessionLogout(
  ctx: KoaContextWithOIDC,
  tenantId: string,
): boolean {
  const requestTenant = (
    ctx.req as typeof ctx.req & {
      tenant?: { id?: unknown };
    }
  ).tenant;
  const requestParams = ctx.oidc.params;
  const client = ctx.oidc.client;
  const session = ctx.oidc.session;
  const hint = ctx.oidc.entities.IdTokenHint?.payload;

  if (
    requestTenant?.id !== tenantId ||
    !requestParams ||
    typeof requestParams.id_token_hint !== 'string' ||
    !client ||
    !session ||
    !hint
  ) {
    return false;
  }

  const clientId = client.clientId;
  const redirectUri = requestParams.post_logout_redirect_uri;
  const currentAuthorization = session.authorizations?.[clientId];

  return (
    requestParams.client_id === clientId &&
    typeof redirectUri === 'string' &&
    client.postLogoutRedirectUris?.includes(redirectUri) === true &&
    hint.iss === ctx.oidc.issuer &&
    hint.aud === clientId &&
    typeof hint.sub === 'string' &&
    hint.sub === session.accountId &&
    typeof hint.sid === 'string' &&
    hint.sid.length > 0 &&
    currentAuthorization?.sid === hint.sid
  );
}

function buildAutoSubmitScript(): string {
  return `(() => {
  const form = document.getElementById('op.logoutForm');
  if (!(form instanceof HTMLFormElement)) return;
  if (typeof form.requestSubmit === 'function') {
    form.requestSubmit();
  } else {
    form.submit();
  }
})();`;
}

function renderAutoSubmitPage(form: string, script: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Signing out</title>
  </head>
  <body data-auto-submit="true">
    <main>
      <p>Signing out&hellip;</p>
      ${form}
      <input type="hidden" name="logout" value="yes" form="op.logoutForm">
      <noscript>
        <button type="submit" name="logout" value="yes" form="op.logoutForm">Continue signing out</button>
      </noscript>
    </main>
    <script>${script}</script>
  </body>
</html>`;
}

function renderConfirmationPage(form: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Confirm sign out</title>
  </head>
  <body data-auto-submit="false">
    <main>
      <h1>Do you want to sign out?</h1>
      ${form}
      <button type="submit" name="logout" value="yes" form="op.logoutForm">Yes, sign me out</button>
      <button type="submit" form="op.logoutForm">No, stay signed in</button>
    </main>
  </body>
</html>`;
}
