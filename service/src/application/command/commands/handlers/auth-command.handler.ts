import {
  WithdrawDto,
  ChangePasswordDto,
  PasswordResetRequestDto,
  PasswordResetDto,
  UpdateProfileDto,
  SignupDto,
} from '@application/dto';
import { AuthCommandPort } from '../ports/auth-command.port';
import { Logger } from '@nestjs/common';
import { ulid } from 'ulid';
import { UserModel } from '@domain/models/user';
import { EventStorePort, EventBusPort } from '@application/command/ports';
import { UserCredentialModel } from '@domain/models/user-credential';
import { PasswordHashPort } from '@application/command/ports/password-hash.port';
import { DomainEvent } from '@domain/events';

export class AuthCommandHandler implements AuthCommandPort {
  private readonly logger = new Logger(AuthCommandHandler.name);

  constructor(
    private readonly eventStore: EventStorePort,
    private readonly eventBus: EventBusPort,
    private readonly passwordHash: PasswordHashPort,
  ) {}

  async signup(tenantId: string, dto: SignupDto): Promise<{ userId: string }> {
    this.logger.log(`Signing up user in tenant ${tenantId} ${dto}`);

    // 1) 유저 ID (= AggregateId ) 생성
    const userId = ulid();
    const passwordHashResult = await this.passwordHash.hash(dto.password);

    // 2) 비밀번호 해시 생성
    const credential = UserCredentialModel.password({
      secretHash: passwordHashResult.hash,
      hashAlg: passwordHashResult.alg,
      hashParams: passwordHashResult.params,
      hashVersion: passwordHashResult.version,
    });

    // 3) UserModel 생성
    const user = UserModel.signup({
      id: userId,
      tenantId,
      username: dto.username,
      email: dto.email,
      phone: dto.phone,
      passwordCredential: credential,
    });

    const events = user.pullEvents();

    // 4) EventStore에 저장
    await this.eventStore.save(userId, events, 0);

    // 5) EventBus에 발행
    await this.eventBus.publishAll(events);

    return { userId };
  }

  async withdraw(
    tenantId: string,
    userId: string,
    dto: WithdrawDto,
  ): Promise<void> {
    this.logger.log(`Withdrawing user=${userId} tenant=${tenantId} ${dto}`);

    // 1) EventStore에서 기존 이벤트 로드
    const events = await this.eventStore.getEvents(userId);
    if (!events || events.length === 0) throw new Error('UserNotFound');

    // tenant 불일치 방지: created 이벤트의 tenantId 확인
    const created: any =
      events.find((e: any) => e.eventType === 'user.created') ??
      events.find((e: any) => e.eventType === 'UserCreated') ??
      events.find((e: any) => e.eventType === 'UserSignedUp');

    if (!created?.payload?.tenantId)
      throw new Error('UserCreatedEventNotFound');
    if (created.payload.tenantId !== tenantId)
      throw new Error('TenantMismatch');

    // 2) UserModel 복원 (불변성/상태 확인용)
    const user = UserModel.rehydrate(events);

    // 3) UserCreatedEvent에서 credential 추출
    const cred = created?.payload?.credential;
    const secretHash: string | undefined = cred?.secretHash;
    const hashAlg: string | undefined = cred?.hashAlg;

    if (!secretHash || !hashAlg) {
      throw new Error('CredentialNotFoundInUserCreatedEvent');
    }

    // 4) PasswordHasherPort로 비밀번호 검증
    const ok = await this.passwordHash.verify(
      secretHash,
      dto.password,
      hashAlg,
    );
    if (!ok) throw new Error('InvalidPassword');

    // 5) Aggregate에 명령 전달 (여기서 AlreadyWithdrawn 등 불변성 체크)
    // occurredAt을 주입 가능하면 좋음
    user.withdraw(new Date());

    const newEvents = user.pullEvents();
    if (newEvents.length === 0) return; // 방어적 코드(보통은 1개)

    // 6) EventStore 저장 (optimistic concurrency)
    const expectedVersion = Math.max(...events.map((e) => e.version));

    await this.eventStore.save(userId, newEvents, expectedVersion);

    // 7) EventBus 발행
    await this.eventBus.publishAll(newEvents);
  }

  async changePassword(
    tenantId: string,
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    this.logger.log(
      `Changing password for user ${userId} in tenant ${tenantId} ${dto}`,
    );
    // 1) EventStore에서 기존 이벤트 로드
    const events = await this.eventStore.getEvents(userId);
    if (!events?.length) throw new Error('UserNotFound');

    // 2) UserModel 복원 (현재 password credential 상태 포함)
    const user = UserModel.rehydrate(events);

    // 3) 현재 credential로 기존 비밀번호 검증
    const currentCred = user.getPasswordCredential();

    const ok = await this.passwordHash.verify(
      currentCred.secretHash,
      dto.currentPassword,
      currentCred.hashAlg,
    );
    if (!ok) throw new Error('InvalidPassword');

    const hashResult = await this.passwordHash.hash(dto.newPassword);
    // hashed 예시: { secretHash, hashAlg, hashParams, hashVersion }
    const newCred = UserCredentialModel.password({
      secretHash: hashResult.hash,
      hashAlg: hashResult.alg,
      hashParams: hashResult.params,
      hashVersion: hashResult.version,
    });

    // 5) Aggregate에 명령 전달 (여기서 AlreadyWithdrawn 등 불변성 체크)
    user.changePassword({
      tenantId,
      newCredential: newCred,
    });

    const newEvents = user.pullEvents();
    if (newEvents.length === 0) return; // 방어적 코드(보통은 1개)

    // 6) EventStore 저장 (optimistic concurrency)
    const expectedVersion = Math.max(...events.map((e) => e.version));

    await this.eventStore.save(userId, newEvents, expectedVersion);

    // 7) EventBus 발행
    await this.eventBus.publishAll(newEvents);
  }

  requestPasswordReset(
    tenantId: string,
    dto: PasswordResetRequestDto,
  ): Promise<void> {
    this.logger.log(`Requesting password reset for tenant ${tenantId} ${dto}`);
    throw new Error('Method not implemented.');
  }
  resetPassword(
    tenantId: string,
    userId: string,
    dto: PasswordResetDto,
  ): Promise<void> {
    this.logger.log(`Resetting password for tenant ${tenantId} ${dto}`);
    throw new Error('Method not implemented.');
  }
  updateProfile(
    tenantId: string,
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<void> {
    this.logger.log(
      `Updating profile for user ${userId} in tenant ${tenantId} ${dto}`,
    );
    throw new Error('Method not implemented.');
  }
  revokeConsent(
    tenantId: string,
    userId: string,
    clientId: string,
  ): Promise<void> {
    this.logger.log(
      `Revoking consent for user ${userId} in tenant ${tenantId} ${clientId}`,
    );
    throw new Error('Method not implemented.');
  }
}
