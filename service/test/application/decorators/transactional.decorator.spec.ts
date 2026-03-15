import { Transactional } from '@application/decorators/transactional.decorator';
import {
  TransactionManagerPort,
  type TransactionPropagation,
} from '@application/ports/transaction-manager.port';

class InMemoryTransactionManager extends TransactionManagerPort {
  private readonly snapshots: number[] = [];

  constructor(private readonly state: { value: number; committed: number }) {
    super();
  }

  async runInTransaction<T>(
    work: () => Promise<T>,
    propagation: TransactionPropagation = 'REQUIRED',
  ): Promise<T> {
    if (propagation === 'NEW') {
      const outerValue = this.state.value;
      const committedSnapshot = this.state.committed;

      // Simulate a separate transaction that starts from the last committed state.
      this.state.value = this.state.committed;

      try {
        const result = await work();
        this.state.committed = this.state.value;
        this.state.value = outerValue;
        return result;
      } catch (error) {
        this.state.value = outerValue;
        this.state.committed = committedSnapshot;
        throw error;
      }
    }

    if (propagation === 'REQUIRED' && this.snapshots.length > 0) {
      return work();
    }

    const snapshot = this.state.value;
    this.snapshots.push(snapshot);

    try {
      const result = await work();
      this.snapshots.pop();
      return result;
    } catch (error) {
      this.state.value = this.state.committed;
      this.snapshots.pop();

      throw error;
    }
  }
}

class TestService {
  constructor(
    public readonly transactionManager: TransactionManagerPort,
    private readonly state: { value: number; committed: number },
  ) {}

  @Transactional()
  async commit(delta: number): Promise<number> {
    this.state.value += delta;
    return this.state.value;
  }

  @Transactional()
  async rollback(delta: number): Promise<void> {
    this.state.value += delta;
    throw new Error('boom');
  }

  @Transactional('NEW')
  async commitInNewTransaction(delta: number): Promise<number> {
    this.state.value += delta;
    return this.state.value;
  }

  @Transactional()
  async outerRollbackAfterInnerNew(delta: number): Promise<void> {
    this.state.value += 1;
    await this.commitInNewTransaction(delta);
    this.state.value = this.state.committed;
    throw new Error('outer-boom');
  }
}

describe('Transactional decorator', () => {
  it('성공 시 트랜잭션 내 변경을 커밋한다', async () => {
    const state = { value: 1, committed: 1 };
    const service = new TestService(new InMemoryTransactionManager(state), state);

    await expect(service.commit(2)).resolves.toBe(3);
    expect(state.value).toBe(3);
  });

  it('예외 발생 시 트랜잭션 내 변경을 롤백한다', async () => {
    const state = { value: 1, committed: 1 };
    const service = new TestService(new InMemoryTransactionManager(state), state);

    await expect(service.rollback(2)).rejects.toThrow('boom');
    expect(state.value).toBe(1);
  });

  it('NEW 전파는 외부 트랜잭션과 분리되어 커밋된다', async () => {
    const state = { value: 1, committed: 1 };
    const service = new TestService(new InMemoryTransactionManager(state), state);

    await expect(service.outerRollbackAfterInnerNew(5)).rejects.toThrow(
      'outer-boom',
    );
    expect(state.value).toBe(6);
    expect(state.committed).toBe(6);
  });
});
