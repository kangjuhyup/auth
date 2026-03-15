import { TransactionManagerPort } from '@application/ports/transaction-manager.port';
import type { TransactionPropagation } from '@application/ports/transaction-manager.port';

type TransactionalTarget = {
  transactionManager?: TransactionManagerPort;
};

export function Transactional(
  propagation: TransactionPropagation = 'REQUIRED',
): MethodDecorator {
  return (
    _target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const original = descriptor.value as
      | ((...args: unknown[]) => Promise<unknown>)
      | undefined;

    if (!original) {
      throw new Error('@Transactional can only be applied to methods');
    }

    descriptor.value = async function (
      this: TransactionalTarget,
      ...args: unknown[]
    ) {
      const transactionManager = this.transactionManager;

      if (!transactionManager) {
        throw new Error(
          `Transactional method "${String(propertyKey)}" requires a transactionManager property`,
        );
      }

      return transactionManager.runInTransaction(
        () => original.apply(this, args),
        propagation,
      );
    };

    return descriptor;
  };
}
