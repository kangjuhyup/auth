import { UserCreatedProjector } from '@infrastructure/projections/user/user-created.projection';
import { UserCreatedEvent } from '@domain/events/user/user-created.event';
import { UserCredentialModel } from '@domain/models/user-credential';

// ✅ 멱등성 헬퍼는 projector 테스트에서 신뢰하지 않고 mock 처리
jest.mock('@infrastructure/projections/projection-helper', () => ({
  withProjectionCheckpoint: async ({ apply, tem }: any) => {
    await apply(tem);
    return 'APPLIED';
  },
}));

describe('UserCreatedProjector', () => {
  const makeEvent = () => {
    const cred = UserCredentialModel.password({
      secretHash: 'hash',
      hashAlg: 'argon2id',
    });

    return new UserCreatedEvent('user-1', new Date(), 1, {
      tenantId: 'tenant-1',
      username: 'john',
      emailVerified: false,
      phoneVerified: false,
      status: 'ACTIVE',
      credential: cred,
    });
  };

  it('eventType이 "user.created"이다', () => {
    const em = {} as any;
    const projector = new UserCreatedProjector(em);

    expect(projector.eventType).toBe('user.created');
  });

  it('projectorName이 "UserCreatedProjector"이다', () => {
    const em = {} as any;
    const projector = new UserCreatedProjector(em);

    expect(projector.projectorName).toBe('UserCreatedProjector');
  });

  it('handle 호출 시 트랜잭션을 시작하고 flush 한다 (호출 순서만 검증)', async () => {
    // tem은 transactional 내부에서 사용되는 트랜잭션 EntityManager 역할
    const tem = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation((_entity: any, data: any) => ({ ...data })),
      persist: jest.fn(),
      flush: jest.fn().mockResolvedValue(undefined),
      getReference: jest.fn().mockReturnValue({ id: 'tenant-1' }),
    };

    // transactional은 콜백을 실행하도록 구성해야 실제 흐름이 탄다
    const transactional = jest.fn(async (fn: any) => fn(tem));

    const em = { transactional } as any;
    const projector = new UserCreatedProjector(em);

    await projector.handle(makeEvent());

    expect(transactional).toHaveBeenCalledTimes(1);
    expect(tem.flush).toHaveBeenCalledTimes(1);

    // 순서 검증 (transactional -> persist -> flush 정도만)
    const callOrder = [
      transactional.mock.invocationCallOrder[0],
      tem.persist.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
      tem.flush.mock.invocationCallOrder[0],
    ];

    expect(callOrder[0]).toBeLessThan(callOrder[1]); // transactional 먼저
    expect(callOrder[1]).toBeLessThan(callOrder[2]); // persist 후 flush
  });
});
