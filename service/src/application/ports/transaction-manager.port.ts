export type TransactionPropagation = 'REQUIRED' | 'NEW';

export abstract class TransactionManagerPort {
  abstract runInTransaction<T>(
    work: () => Promise<T>,
    propagation?: TransactionPropagation,
  ): Promise<T>;
}
