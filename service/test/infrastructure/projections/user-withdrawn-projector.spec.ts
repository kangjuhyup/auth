import { UserWithdrawnProjector } from '@infrastructure/projections/user/user-withdrawn.projection';

jest.mock('@infrastructure/projections/projection-helper', () => ({
  withProjectionCheckpoint: async ({ apply, tem }: any) => {
    await apply(tem);
    return 'APPLIED';
  },
}));

describe('UserWithdrawnProjector', () => {
  it('user status를 WITHDRAWN으로 변경한다', async () => {
    const userRow: any = { status: 'ACTIVE' };

    const tem = {
      findOne: jest.fn().mockResolvedValue(userRow),
      persist: jest.fn(),
      flush: jest.fn(),
    };

    const em = {
      transactional: async (fn: any) => fn(tem),
    };

    const projector = new UserWithdrawnProjector(em as any);

    await projector.handle({
      eventType: 'user.withdrawn',
      aggregateId: 'user-1',
      version: 2,
      occurredAt: new Date(),
      payload: { tenantId: 'tenant-1', withdrawnAt: new Date() },
    } as any);

    expect(userRow.status).toBe('WITHDRAWN');
  });
});
