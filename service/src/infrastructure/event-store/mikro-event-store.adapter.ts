import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { ulid } from 'ulid';
import type { DomainEvent } from '@domain/events';
import type { EventStorePort } from '@application/ports/event-store.port';
import { EventSourcingOrmEntity } from '@infrastructure/mikro-orm/entities/event-sourcing';

function serializeEventData(e: DomainEvent): Record<string, unknown> {
  // DomainEvent 공통 필드를 제외한 "추가 필드"들을 저장한다.
  // (UserCreatedEvent가 payload 같은 필드를 가진다면 그대로 들어감)
  const { eventType, aggregateId, occurredAt, version, ...rest } = e as any;

  // Date가 섞여 있으면 JSON으로 깨질 수 있으니 Date → ISO로 변환
  return JSON.parse(
    JSON.stringify(rest, (_k, v) => (v instanceof Date ? v.toISOString() : v)),
  );
}

function restoreEventData(data: any): any {
  // 저장된 data에는 occurredAt 등이 없고, 내부에 ISO date가 있을 수 있으니
  // 여기서 강제 변환까지 하고 싶으면 키 기반으로 처리하면 됨.
  // (일단은 그대로 사용)
  return data ?? {};
}

@Injectable()
export class MikroEventStoreAdapter implements EventStorePort {
  constructor(private readonly em: EntityManager) {}

  async getEvents(aggregateId: string): Promise<DomainEvent[]> {
    const rows = await this.em.find(
      EventSourcingOrmEntity,
      { aggregateId },
      { orderBy: { version: 'asc' } },
    );

    return rows.map((r) => {
      const extra = restoreEventData(r.data as any);

      // DomainEvent 인터페이스 + 이벤트별 추가필드(예: payload)를 합쳐서 반환
      return {
        eventType: r.eventType,
        aggregateId: r.aggregateId,
        occurredAt: r.occurredAt,
        version: r.version,
        ...extra,
      } as DomainEvent;
    });
  }

  async save(
    aggregateId: string,
    events: DomainEvent[],
    expectedVersion: number,
  ): Promise<void> {
    if (events.length === 0) return;

    // 안전장치: aggregateId 불일치 방지
    for (const e of events) {
      if (e.aggregateId !== aggregateId)
        throw new Error('EventAggregateMismatch');
    }

    await this.em.transactional(async (tem) => {
      // 1) 최신 버전 조회
      const latest = await tem.findOne(
        EventSourcingOrmEntity,
        { aggregateId },
        { orderBy: { version: 'desc' }, fields: ['version'] as any },
      );

      const currentVersion = latest?.version ?? 0;

      // 2) optimistic concurrency 체크
      if (currentVersion !== expectedVersion) {
        throw new Error('ConcurrencyConflict');
      }

      // 3) append-only insert (버전 순서 강제)
      let v = expectedVersion;

      for (const e of events) {
        v += 1;
        if (e.version !== v) {
          throw new Error('InvalidEventVersionSequence');
        }

        const row = tem.create(EventSourcingOrmEntity, {
          id: ulid(),
          aggregateId,
          version: e.version,
          eventType: e.eventType,
          data: serializeEventData(e),
          occurredAt: e.occurredAt,
        });

        tem.persist(row);
      }

      // 4) flush (유니크 충돌 시 동시성 충돌로 처리)
      try {
        await tem.flush();
      } catch {
        throw new Error('ConcurrencyConflict');
      }
    });
  }
}
