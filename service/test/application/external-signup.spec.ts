import { ExternalSignupCommandHandler } from '../../src/application/commands/handlers/external-signup-command.handler';
import { UserModel } from '../../src/domain/models/user';

describe('external signup waits for service membership decision', () => {
  const ticket = {
    ticketId: 'ticket-id',
    tenantId: 'tenant',
    tenantCode: 'demo',
    clientId: 'app',
    uid: 'interaction',
    provider: 'kakao',
    providerSub: '123',
    browserHash: 'browser',
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    attemptId: 'attempt',
    profile: {},
  };
  let store: any;
  let repository: any;
  let handler: ExternalSignupCommandHandler;
  beforeEach(() => {
    store = {
      claimTicket: jest.fn(async () => ticket),
      completeTicket: jest.fn(),
      bindCompletionKey: jest.fn(async () => true),
      getTicket: jest.fn(async () => ({
        ...ticket,
        consumerClientId: 'service',
        claimedAttemptId: 'attempt',
      })),
    };
    repository = { complete: jest.fn(async () => 'subject') };
    handler = new ExternalSignupCommandHandler(
      store,
      repository,
      { hash: (key: string) => key } as any,
      { get: () => 'https://auth.example' } as any,
    );
  });
  it('claim validates the browser ticket without creating a user', async () => {
    expect(
      await handler.claim('tenant', 'service', {
        ticket: 'opaque',
        clientId: 'app',
        attemptId: 'attempt',
      }),
    ).toMatchObject({
      ticketId: 'ticket-id',
      providerSub: '123',
      issuer: 'https://auth.example/t/demo/oidc',
    });
    expect(repository.complete).not.toHaveBeenCalled();
  });
  it('completes the verified identity and makes the subject resumable', async () => {
    expect(
      await handler.complete(
        'tenant',
        'service',
        { ticket: 'opaque', clientId: 'app', attemptId: 'attempt' },
        'stable-key',
      ),
    ).toEqual({
      issuer: 'https://auth.example/t/demo/oidc',
      subject: 'subject',
    });
    expect(store.completeTicket).toHaveBeenCalled();
  });
  it('does not provision an expired/unclaimed ticket', async () => {
    store.getTicket.mockResolvedValue(null);
    await expect(
      handler.complete(
        'tenant',
        'service',
        { ticket: 'opaque', clientId: 'app', attemptId: 'attempt' },
        'stable-key',
      ),
    ).rejects.toThrow();
    expect(repository.complete).not.toHaveBeenCalled();
  });
  it('does not let a different service or client consume a claim', async () => {
    await expect(
      handler.complete(
        'tenant',
        'other',
        { ticket: 'opaque', clientId: 'app', attemptId: 'attempt' },
        'stable-key',
      ),
    ).rejects.toThrow();
    await expect(
      handler.complete(
        'tenant',
        'service',
        { ticket: 'opaque', clientId: 'other', attemptId: 'attempt' },
        'stable-key',
      ),
    ).rejects.toThrow();
    expect(repository.complete).not.toHaveBeenCalled();
  });
  it('creates a real passwordless domain user', () => {
    const user = UserModel.createExternal({
      id: 'subject',
      tenantId: 'tenant',
      provisionedByClientId: 'service',
      provisioningKeyHash: 'key',
    });
    expect(user.passwordCredential).toBeUndefined();
    expect(user.status).toBe('ACTIVE');
  });
});
