import { Injectable } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { TransactionManagerPort } from '@application/ports/transaction-manager.port';
import type { TransactionPropagation } from '@application/ports/transaction-manager.port';

@Injectable()
export class MikroOrmTransactionManager implements TransactionManagerPort {
  constructor(private readonly orm: MikroORM) {}

  runInTransaction<T>(
    work: () => Promise<T>,
    propagation: TransactionPropagation = 'REQUIRED',
  ): Promise<T> {
    const em =
      propagation === 'NEW' ? this.orm.em.fork() : this.orm.em;

    return em.transactional(() => work());
  }
}
