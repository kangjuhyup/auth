import type { DomainEvent } from '@domain/events';
import { PersistenceModel } from './persistence-model';
import { UserCredentialModel } from './user-credential';
import { UserCreatedEvent } from '@domain/events/user/user-created.event';
import { UserWithdrawnEvent } from '@domain/events/user/user-withdrawn.event';

export type UserStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED' | 'WITHDRAWN';

interface UserProps {
  tenantId: string;
  username: string;
  email?: string;
  emailVerified: boolean;
  phone?: string;
  phoneVerified: boolean;
  status: UserStatus;
}

type UserCreatedLike = {
  eventType: string;
  aggregateId: string;
  version: number;
  payload: {
    tenantId: string;
    username: string;
    email?: string;
    emailVerified: boolean;
    phone?: string;
    phoneVerified: boolean;
    status?: UserStatus;
    credential?: unknown;
  };
};

export class UserModel extends PersistenceModel<string, UserProps> {
  private uncommitted: DomainEvent[] = [];
  private currentVersion = 0;

  private constructor(props: UserProps, id: string) {
    super(props, id);
  }

  /* ==============================
     Factories
  =============================== */

  static signup(params: {
    id: string;
    tenantId: string;
    username: string;
    email?: string;
    phone?: string;
    passwordCredential: UserCredentialModel;
    occurredAt?: Date;
  }): UserModel {
    const occurredAt = params.occurredAt ?? new Date();

    // 초기 props는 apply(UserCreatedEvent)가 세팅하도록 "기본값"만 넣어둠
    const user = new UserModel(
      {
        tenantId: params.tenantId,
        username: params.username.trim(),
        email: params.email,
        emailVerified: false,
        phone: params.phone,
        phoneVerified: false,
        status: 'ACTIVE',
      },
      params.id,
    );

    user.record(
      new UserCreatedEvent(user.id, occurredAt, user.nextVersion(), {
        tenantId: user.tenantId,
        username: user.username,
        email: user.email,
        emailVerified: user.emailVerified,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
        status: user.status,
        credential: params.passwordCredential,
      }),
    );

    return user;
  }

  /**
   * 이벤트 스토어에서 로드한 이벤트로 모델 복원
   * - 상태 변경은 apply()만 수행
   * - uncommitted 이벤트는 없음
   */
  static rehydrate(events: DomainEvent[]): UserModel {
    if (!events || events.length === 0)
      throw new Error('CannotRehydrateEmptyEvents');

    const created = findUserCreated(events);
    if (!created?.payload?.tenantId)
      throw new Error('UserCreatedEventNotFound');

    const model = new UserModel(
      {
        tenantId: created.payload.tenantId,
        username: created.payload.username,
        email: created.payload.email,
        emailVerified: created.payload.emailVerified,
        phone: created.payload.phone,
        phoneVerified: created.payload.phoneVerified,
        status: (created.payload.status ?? 'ACTIVE') as UserStatus,
      },
      created.aggregateId,
    );

    // 이벤트를 순서대로 적용 (혹시 섞여오면 안전하게 정렬)
    const sorted = [...events].sort((a, b) => a.version - b.version);
    for (const ev of sorted) model.apply(ev, { isReplaying: true });

    // replay 결과로 현재 버전 세팅
    model.currentVersion = Math.max(...sorted.map((e) => e.version));
    return model;
  }

  /* ==============================
     Commands (Domain behaviors)
  =============================== */

  withdraw(occurredAt: Date = new Date()): void {
    if (this.status === 'WITHDRAWN') throw new Error('AlreadyWithdrawn');

    this.record(
      new UserWithdrawnEvent(this.id, occurredAt, this.nextVersion(), {
        tenantId: this.tenantId,
        withdrawnAt: occurredAt,
      }),
    );
  }

  /* ==============================
     Event handling
  =============================== */

  pullEvents(): DomainEvent[] {
    const out = [...this.uncommitted];
    this.uncommitted = [];
    return out;
  }

  private nextVersion(): number {
    return this.currentVersion + 1;
  }

  /**
   * record = (apply + uncommitted append) 단일 진입점
   */
  private record(event: DomainEvent): void {
    this.apply(event, { isReplaying: false });
    this.uncommitted.push(event);
    this.currentVersion = event.version;
  }

  private apply(ev: DomainEvent, ctx: { isReplaying: boolean }): void {
    switch (ev.eventType) {
      case 'user.created':
      case 'UserCreated':
      case 'UserSignedUp': {
        // created 이벤트를 여기서도 반영 가능하게(선택)
        const e = ev as any as UserCreatedLike;
        this.etc.tenantId = e.payload.tenantId;
        this.etc.username = e.payload.username;
        this.etc.email = e.payload.email;
        this.etc.emailVerified = !!e.payload.emailVerified;
        this.etc.phone = e.payload.phone;
        this.etc.phoneVerified = !!e.payload.phoneVerified;
        this.etc.status = (e.payload.status ?? 'ACTIVE') as UserStatus;
        break;
      }

      case 'user.withdrawn': {
        this.etc.status = 'WITHDRAWN';
        break;
      }

      default:
        // 다른 이벤트가 추가되면 여기에서 확장
        break;
    }

    // replay 중에는 currentVersion은 rehydrate()에서 마지막에 한 번 세팅 (record가 아니라면)
    if (ctx.isReplaying) {
      this.currentVersion = Math.max(this.currentVersion, ev.version);
    }
  }

  /* ==============================
     Getters
  =============================== */

  get tenantId(): string {
    return this.etc.tenantId;
  }
  get username(): string {
    return this.etc.username;
  }
  get email(): string | null | undefined {
    return this.etc.email;
  }
  get emailVerified(): boolean {
    return this.etc.emailVerified;
  }
  get phone(): string | null | undefined {
    return this.etc.phone;
  }
  get phoneVerified(): boolean {
    return this.etc.phoneVerified;
  }
  get status(): UserStatus {
    return this.etc.status;
  }
}

/* ==============================
   Helpers
============================== */

function findUserCreated(events: DomainEvent[]): any {
  return (
    (events as any[]).find((e) => e.eventType === 'user.created') ??
    (events as any[]).find((e) => e.eventType === 'UserCreated') ??
    (events as any[]).find((e) => e.eventType === 'UserSignedUp')
  );
}
