import { Entity, PrimaryKey, Property, Unique, Index } from '@mikro-orm/core';

@Entity({ tableName: 'projection_checkpoint' })
@Unique({
  properties: ['projector', 'aggregateId'],
  name: 'uk_checkpoint_projector_aggregate',
})
@Index({ properties: ['projector', 'aggregateId'] })
export class ProjectionCheckpointOrmEntity {
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @Property({ type: 'varchar', length: 128 })
  projector!: string; // 예: 'UserSignedUpProjector'

  @Property({ fieldName: 'aggregate_id', type: 'char', length: 26 })
  aggregateId!: string;

  @Property({ fieldName: 'last_version', type: 'int', default: 0 })
  lastVersion!: number;

  @Property({
    fieldName: 'updated_at',
    type: 'datetime',
    onCreate: () => new Date(),
    onUpdate: () => new Date(),
  })
  updatedAt?: Date;
}
