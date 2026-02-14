import { UserPasswordChangedProjector } from '@infrastructure/projections/user/user-password-changed.projection';

jest.mock('@infrastructure/projections/projection-helper', () => ({
  withProjectionCheckpoint: jest.fn(),
}));

import { withProjectionCheckpoint } from '@infrastructure/projections/projection-helper';
import { UserPasswordChangedEvent } from '@domain/events/user/user-password-change.event';

describe('UserPasswordChangedProjector', () => {
  const makeEvent = () =>
    new UserPasswordChangedEvent('user-1', new Date(), 2, {
      tenantId: 'tenant-1',
      changedAt: new Date(),
      credential: {
        type: 'password',
        secretHash: 'new-hash',
        hashAlg: 'argon2id',
        hashParams: null,
        hashVersion: null,
        enabled: true,
        expiresAt: null,
      } as any,
    });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('eventType/projectorName이 올바르다', () => {
    const em = {} as any;
    const p = new UserPasswordChangedProjector(em);

    expect(p.eventType).toBe('user.password_changed');
    expect(p.projectorName).toBe('UserPasswordChangedProjector');
  });

  it('handle: transactional을 시작하고(APPLIED) flush 한다 (호출 여부/순서만 검증)', async () => {
    // tem mock
    const tem = {
      getReference: jest.fn(),
      findOne: jest.fn().mockResolvedValue(undefined),
      create: jest.fn(),
      persist: jest.fn(),
      flush: jest.fn().mockResolvedValue(undefined),
    };

    // em.transactional이 콜백을 실행하도록 구성
    const em = {
      transactional: jest.fn(async (fn: any) => fn(tem)),
    } as any;

    // withProjectionCheckpoint는 apply를 실행시키고 APPLIED 반환
    (withProjectionCheckpoint as jest.Mock).mockImplementation(
      async ({ apply }: any) => {
        await apply(tem);
        return 'APPLIED';
      },
    );

    const projector = new UserPasswordChangedProjector(em);
    await projector.handle(makeEvent() as any);

    expect(em.transactional).toHaveBeenCalledTimes(1);
    expect(withProjectionCheckpoint).toHaveBeenCalledTimes(1);
    expect(tem.flush).toHaveBeenCalledTimes(1);

    // 순서: transactional → flush (같은 tick이라 완벽 순서가 애매할 수 있어 최소만)
    expect(em.transactional.mock.invocationCallOrder[0]).toBeLessThan(
      tem.flush.mock.invocationCallOrder[0],
    );
  });

  it('handle: SKIPPED이면 flush 하지 않는다', async () => {
    const tem = {
      flush: jest.fn().mockResolvedValue(undefined),
    };

    const em = {
      transactional: jest.fn(async (fn: any) => fn(tem)),
    } as any;

    (withProjectionCheckpoint as jest.Mock).mockResolvedValue('SKIPPED');

    const projector = new UserPasswordChangedProjector(em);
    await projector.handle(makeEvent() as any);

    expect(em.transactional).toHaveBeenCalledTimes(1);
    expect(withProjectionCheckpoint).toHaveBeenCalledTimes(1);
    expect(tem.flush).not.toHaveBeenCalled();
  });
});
