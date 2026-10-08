import { createRpInitiatedLogoutSource } from '@infrastructure/oidc-provider/security/rp-initiated-logout-source';

describe('RP-initiated logout source', () => {
  const form =
    '<form id="op.logoutForm" method="post" action="https://auth.example.test/session/end/confirm"><input type="hidden" name="xsrf" value="provider-xsrf"/></form>';

  it('provider가 검증한 hint와 현재 tenant/client/user/session이 모두 일치하면 native form을 자동 제출한다', async () => {
    const source = createRpInitiatedLogoutSource({ tenantId: 'tenant-1' });
    const ctx = makeContext();

    await source(ctx as any, form);

    expect(ctx.type).toBe('html');
    expect(ctx.status).toBe(200);
    expect(ctx.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(ctx.set).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    expect(ctx.body).toContain('data-auto-submit="true"');
    expect(ctx.body).toContain(form);
    expect(ctx.body).toContain(
      'name="logout" value="yes" form="op.logoutForm"',
    );
    expect(ctx.body).toContain('requestSubmit');
    expect(ctx.body).not.toContain('id-token-value');
    expect(ctx.set).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("script-src 'sha256-"),
    );
    expect(ctx.set).not.toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("'unsafe-inline'"),
    );
  });

  it.each([
    ['hint가 없음', { hintPayload: null }],
    ['tenant가 다름', { requestTenantId: 'tenant-2' }],
    ['issuer가 다름', { hintIssuer: 'https://other.example.test' }],
    ['audience가 다름', { hintAudience: 'client-2' }],
    ['client_id가 다름', { requestClientId: 'client-2' }],
    ['사용자가 다름', { hintSubject: 'user-2' }],
    ['sid가 없음', { hintSid: undefined }],
    ['sid가 stale임', { hintSid: 'sid-stale' }],
    ['현재 client authorization이 없음', { sessionHasAuthorization: false }],
    ['반환 URI가 없음', { redirectUri: undefined }],
    [
      '반환 URI가 정확히 등록되지 않음',
      { redirectUri: 'https://app.example.test/logout/other' },
    ],
  ])('%s이면 자동 승인하지 않는다', async (_label, overrides) => {
    const source = createRpInitiatedLogoutSource({ tenantId: 'tenant-1' });
    const ctx = makeContext(overrides);

    await source(ctx as any, form);

    expect(ctx.body).toContain('data-auto-submit="false"');
    expect(ctx.body).toContain(form);
    expect(ctx.body).toContain('name="logout" value="yes"');
    expect(ctx.body).not.toContain('requestSubmit');
  });

  it('state는 자동 승인 판단에 사용하지 않고 provider의 native 처리에 맡긴다', async () => {
    const source = createRpInitiatedLogoutSource({ tenantId: 'tenant-1' });
    const ctx = makeContext({ state: 'opaque-consumer-state' });

    await source(ctx as any, form);

    expect(ctx.body).toContain('data-auto-submit="true"');
    expect(ctx.body).not.toContain('opaque-consumer-state');
  });
});

type ContextOverrides = {
  requestTenantId?: string;
  requestClientId?: string;
  redirectUri?: string;
  state?: string;
  hintPayload?: Record<string, unknown> | null;
  hintIssuer?: string;
  hintAudience?: string;
  hintSubject?: string;
  hintSid?: string;
  sessionHasAuthorization?: boolean;
};

function makeContext(overrides: ContextOverrides = {}) {
  const issuer = 'https://auth.example.test/t/acme/oidc';
  const clientId = 'client-1';
  const redirectUri = Object.prototype.hasOwnProperty.call(
    overrides,
    'redirectUri',
  )
    ? overrides.redirectUri
    : 'https://app.example.test/logout';
  const hintPayload =
    overrides.hintPayload === null
      ? undefined
      : (overrides.hintPayload ?? {
          iss: overrides.hintIssuer ?? issuer,
          aud: overrides.hintAudience ?? clientId,
          sub: overrides.hintSubject ?? 'user-1',
          sid: Object.prototype.hasOwnProperty.call(overrides, 'hintSid')
            ? overrides.hintSid
            : 'sid-current',
        });
  const params: Record<string, unknown> = {
    id_token_hint: 'id-token-value',
    client_id: overrides.requestClientId ?? clientId,
    state: overrides.state,
  };
  if (redirectUri !== undefined) {
    params.post_logout_redirect_uri = redirectUri;
  }

  return {
    req: {
      tenant: { id: overrides.requestTenantId ?? 'tenant-1' },
    },
    oidc: {
      issuer,
      params,
      client: {
        clientId,
        postLogoutRedirectUris: ['https://app.example.test/logout'],
      },
      entities: {
        IdTokenHint: hintPayload ? { payload: hintPayload } : undefined,
      },
      session: {
        accountId: 'user-1',
        authorizations:
          overrides.sessionHasAuthorization === false
            ? {}
            : { [clientId]: { sid: 'sid-current' } },
      },
    },
    set: jest.fn(),
    type: undefined as string | undefined,
    status: undefined as number | undefined,
    body: undefined as string | undefined,
  };
}
