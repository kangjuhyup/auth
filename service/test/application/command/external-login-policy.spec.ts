import { InteractionCommandHandler } from '@application/commands/handlers/interaction-command.handler';
const tenant = { id: 'tenant', code: 'demo', name: 'Demo' };
function setup(status = 'ACTIVE', mfaEnabled = false, mfaRequired = false) {
  const users = {
    findProfile: jest.fn(async () => ({
      tenantId: 'tenant',
      userId: 'subject',
      status,
      mfaEnabled,
    })),
    getMfaMethods: jest.fn(async () => ['totp']),
  };
  const oidc = {
    resolveExternalSignup: jest.fn(async () => ({ userId: 'subject' })),
    getDetails: jest.fn(async () => ({ mfaRequired })),
    completeLogin: jest.fn(async () => ({
      redirectTo: '/t/demo/oidc/auth/resume',
    })),
  };
  const handler = new InteractionCommandHandler(
    users as any,
    oidc as any,
    {} as any,
    { incrementCounter: jest.fn() } as any,
    {} as any,
  );
  return { handler, users, oidc };
}
const request = {
  tenantCode: 'demo',
  uid: 'uid123456',
  ticket: 'ticket',
  attemptId: 'attempt',
  tenant,
  req: {},
  res: {},
};
describe('external identities share password login account and MFA policy', () => {
  it.each(['LOCKED', 'DISABLED', 'WITHDRAWN'])(
    'does not issue a session for a %s user',
    async (status) => {
      const { handler, oidc } = setup(status);
      expect(await handler.resumeExternalSignup(request)).toEqual({
        status: 403,
        body: { error: 'user_inactive' },
      });
      expect(oidc.completeLogin).not.toHaveBeenCalled();
    },
  );
  it.each([
    [true, false],
    [false, true],
  ])('requires MFA for user=%s or policy=%s', async (enabled, required) => {
    const { handler, oidc } = setup('ACTIVE', enabled, required);
    expect((await handler.resumeExternalSignup(request)).body).toMatchObject({
      mfaRequired: true,
      methods: ['totp'],
    });
    expect(oidc.completeLogin).not.toHaveBeenCalled();
  });
  it('completes a provider session only after validated external proof and active status', async () => {
    const { handler, oidc } = setup();
    expect((await handler.resumeExternalSignup(request)).body).toMatchObject({
      redirectTo: '/t/demo/oidc/auth/resume',
    });
    expect(oidc.completeLogin).toHaveBeenCalled();
  });
});
