import { ConflictException } from '@nestjs/common';
import { UserProvisioningError } from '@application/commands/ports/user-provisioning-command.port';
import { UserProvisioningController } from '@presentation/controllers/user-provisioning.controller';

describe('UserProvisioningController', () => {
  it('tenant, service client, idempotency key와 body를 command port에만 위임한다', async () => {
    const commands = {
      provision: jest.fn().mockResolvedValue({ subject: 'user-1' }),
    };
    const controller = new UserProvisioningController(commands as any);
    const auditContext = { correlationId: 'request-1' } as any;

    await expect(
      controller.provision(
        { id: 'tenant-1' } as any,
        { clientId: 'provisioner', scope: 'auth.user.provision' },
        'registration-attempt-1234',
        { username: 'alice', password: 'Secure123!' },
        auditContext,
      ),
    ).resolves.toEqual({ subject: 'user-1' });
    expect(commands.provision).toHaveBeenCalledWith(
      'tenant-1',
      'provisioner',
      expect.objectContaining({
        username: 'alice',
        password: 'Secure123!',
        idempotencyKey: 'registration-attempt-1234',
      }),
      auditContext,
    );
  });

  it('application conflict만 409로 변환한다', async () => {
    const commands = {
      provision: jest
        .fn()
        .mockRejectedValue(new UserProvisioningError('username_conflict')),
    };
    const controller = new UserProvisioningController(commands as any);

    await expect(
      controller.provision(
        { id: 'tenant-1' } as any,
        { clientId: 'provisioner', scope: 'auth.user.provision' },
        'registration-attempt-1234',
        { username: 'alice', password: 'Secure123!' },
        {} as any,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
