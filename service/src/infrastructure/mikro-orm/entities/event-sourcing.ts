import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'es_events' })
@Index({ properties: ['aggregateId'] })
@Unique({
  properties: ['aggregateId', 'version'],
  name: 'uk_es_events_aggregate_version',
})
export class EventSourcingOrmEntity {
  @PrimaryKey({ type: 'char', length: 26 })
  id!: string; // ulid

  @Property({ fieldName: 'aggregate_id', type: 'char', length: 26 })
  aggregateId!: string;

  @Property({ type: 'int' })
  version!: number;

  @Property({ fieldName: 'event_type', type: 'varchar', length: 128 })
  eventType!: string;

  @Property({ type: 'json' })
  data!: unknown; // 이벤트 상세(추가 필드들)

  @Property({ fieldName: 'occurred_at', type: 'datetime' })
  occurredAt!: Date;
}
