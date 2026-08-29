import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import type {
  BootstrapFailureCode,
  BootstrapProcessStatus,
} from '@application/process-managers/bootstrap-process-state';
import { BaseEntity } from '../base';

@Entity({ tableName: 'bootstrap_process' })
export class BootstrapProcessOrmEntity extends BaseEntity {
  @PrimaryKey({
    fieldName: 'process_key',
    type: 'varchar',
    length: 128,
  })
  processKey!: string;

  @Property({ type: 'varchar', length: 64 })
  step!: string;

  @Property({ type: 'varchar', length: 16 })
  status!: BootstrapProcessStatus;

  @Property({ fieldName: 'retry_count', type: 'int', default: 0 })
  retryCount = 0;

  @Property({
    fieldName: 'last_failure_code',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  lastFailureCode: BootstrapFailureCode | null = null;
}
