import { MikroOrmTransactionManager } from '@infrastructure/transactions/mikro-orm-transaction-manager';

describe('MikroOrmTransactionManager', () => {
  it('MikroORM transactional API에 위임한다', async () => {
    const work = jest.fn().mockResolvedValue('ok');
    const transactional = jest
      .fn()
      .mockImplementation(async (cb: () => Promise<string>) => cb());
    const orm = {
      em: {
        transactional,
        fork: jest.fn(),
      },
    } as any;

    const manager = new MikroOrmTransactionManager(orm);

    await expect(manager.runInTransaction(work)).resolves.toBe('ok');
    expect(transactional).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('NEW 전파 시 fork된 EntityManager로 별도 트랜잭션을 생성한다', async () => {
    const work = jest.fn().mockResolvedValue('ok');
    const forkedTransactional = jest
      .fn()
      .mockImplementation(async (cb: () => Promise<string>) => cb());
    const fork = jest.fn().mockReturnValue({
      transactional: forkedTransactional,
    });
    const transactional = jest.fn();
    const orm = {
      em: {
        transactional,
        fork,
      },
    } as any;

    const manager = new MikroOrmTransactionManager(orm);

    await expect(manager.runInTransaction(work, 'NEW')).resolves.toBe('ok');
    expect(fork).toHaveBeenCalledTimes(1);
    expect(forkedTransactional).toHaveBeenCalledTimes(1);
    expect(transactional).not.toHaveBeenCalled();
  });

  it('예외를 그대로 전파한다', async () => {
    const transactional = jest
      .fn()
      .mockImplementation(async (cb: () => Promise<never>) => cb());
    const orm = {
      em: {
        transactional,
        fork: jest.fn(),
      },
    } as any;

    const manager = new MikroOrmTransactionManager(orm);

    await expect(
      manager.runInTransaction(async () => {
        throw new Error('failed');
      }),
    ).rejects.toThrow('failed');
  });
});
