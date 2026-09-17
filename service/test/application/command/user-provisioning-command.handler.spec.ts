import { UserProvisioningCommandHandler } from '@application/commands/handlers/user-provisioning-command.handler';
import { ProvisionUserCommand } from '@application/commands/commands/provision-user.command';
import type { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';

describe('UserProvisioningCommandHandler', () => {
  const tenantId = 'tenant-1';
  const clientId = 'service-user-provisioner';
  const command = ProvisionUserCommand.of({
    username: 'alice',
    password: 'correct horse battery staple',
    idempotencyKey: 'registration-attempt-1234',
  });

  function setup() {
    const repository = {
      findById: jest.fn(),
      findByUsername: jest.fn().mockResolvedValue(undefined),
      findByProvisioningKey: jest.fn().mockResolvedValue(undefined),
      findByContact: jest.fn(),
      list: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      findCredentialsByType: jest.fn(),
      createCredential: jest.fn(),
      saveCredential: jest.fn(),
    } as unknown as jest.Mocked<UserWriteRepositoryPort>;
    const passwordHash = {
      hash: jest.fn().mockResolvedValue({
        hash: 'argon-hash',
        alg: 'argon2id',
        params: { memoryCost: 19456 },
        version: 1,
      }),
    };
    const keyHash = {
      hash: jest.fn().mockReturnValue('a'.repeat(64)),
    };
    const auditRecorder = { recordAdminAction: jest.fn() };
    const clients = {
      findByClientId: jest.fn().mockResolvedValue({ id: '5', clientId }),
    };
    const handler = new UserProvisioningCommandHandler(
      repository,
      passwordHash as any,
      keyHash as any,
      auditRecorder as any,
      clients as any,
    );
    return {
      handler,
      repository,
      passwordHash,
      keyHash,
      auditRecorder,
      clients,
    };
  }

  it('ACTIVE 사용자와 password credential을 tenant/client/idempotency binding으로 생성한다', async () => {
    const { handler, repository, passwordHash, auditRecorder } = setup();

    const result = await handler.provision(tenantId, clientId, command, {
      correlationId: 'correlation-1',
    } as any);

    expect(result.subject).toHaveLength(26);
    expect(passwordHash.hash).toHaveBeenCalledWith(command.password);
    const saved = repository.save.mock.calls[0][0];
    expect(saved.tenantId).toBe(tenantId);
    expect(saved.status).toBe('ACTIVE');
    expect(saved.provisionedByClientId).toBe(clientId);
    expect(saved.provisioningKeyHash).toBe('a'.repeat(64));
    expect(auditRecorder.recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        clientId: '5',
        action: 'CREATE',
        resourceId: result.subject,
      }),
    );
    expect(
      JSON.stringify(auditRecorder.recordAdminAction.mock.calls),
    ).not.toContain(command.password);
    expect(
      JSON.stringify(auditRecorder.recordAdminAction.mock.calls),
    ).not.toContain(command.idempotencyKey);
  });

  it('같은 client와 idempotency key의 재시도는 기존 subject를 반환한다', async () => {
    const { handler, repository, passwordHash } = setup();
    repository.findByProvisioningKey.mockResolvedValue({
      id: 'existing-subject',
      username: 'alice',
    } as any);

    await expect(
      handler.provision(tenantId, clientId, command),
    ).resolves.toEqual({ subject: 'existing-subject' });
    expect(passwordHash.hash).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('같은 idempotency key가 다른 username에 재사용되면 충돌한다', async () => {
    const { handler, repository } = setup();
    repository.findByProvisioningKey.mockResolvedValue({
      id: 'existing-subject',
      username: 'bob',
    } as any);

    await expect(
      handler.provision(tenantId, clientId, command),
    ).rejects.toMatchObject({
      code: 'idempotency_conflict',
    });
  });

  it('동시 생성의 unique 충돌은 저장된 동일 binding을 재조회해 멱등 응답한다', async () => {
    const { handler, repository } = setup();
    repository.findByProvisioningKey
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        id: 'concurrent-subject',
        username: 'alice',
      } as any);
    repository.save.mockRejectedValueOnce(new Error('unique violation'));

    await expect(
      handler.provision(tenantId, clientId, command),
    ).resolves.toEqual({ subject: 'concurrent-subject' });
    expect(repository.findByProvisioningKey).toHaveBeenCalledTimes(2);
  });

  it('다른 key의 동시 username unique 충돌은 계약된 conflict로 변환한다', async () => {
    const { handler, repository } = setup();
    repository.findByUsername
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 'concurrent-subject' } as any);
    repository.save.mockRejectedValueOnce(new Error('unique violation'));

    await expect(
      handler.provision(tenantId, clientId, command),
    ).rejects.toMatchObject({ code: 'username_conflict' });
    expect(repository.findByProvisioningKey).toHaveBeenCalledTimes(2);
  });

  it('다른 client의 같은 key는 별도 namespace로 조회한다', async () => {
    const { handler, repository } = setup();

    await handler.provision(tenantId, 'another-client', command);

    expect(repository.findByProvisioningKey).toHaveBeenCalledWith(
      tenantId,
      'another-client',
      'a'.repeat(64),
    );
  });

  it('client가 사라졌다면 사용자 생성 전에 중단한다', async () => {
    const { handler, repository, clients } = setup();
    clients.findByClientId.mockResolvedValue(null);

    await expect(
      handler.provision(tenantId, clientId, command),
    ).rejects.toThrow('Provisioning client unavailable');
    expect(repository.save).not.toHaveBeenCalled();
  });
});
