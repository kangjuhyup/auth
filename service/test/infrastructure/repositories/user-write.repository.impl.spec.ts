import './support/mock-mikro-orm-core';

import { UserWriteRepositoryImpl } from '@infrastructure/repositories/user-write.repository.impl';
import { UserOrmEntity } from '@infrastructure/mikro-orm/entities/user';
import { UserCredentialOrmEntity } from '@infrastructure/mikro-orm/entities/user-credential';
import { TenantOrmEntity } from '@infrastructure/mikro-orm/entities/tenant';
import {
  EntityManagerMock,
  attachCredentials,
  createEntityManagerMock,
  createTransactionalEntityManagers,
  createUserCredentialEntity,
  createUserCredentialModel,
  createUserEntity,
  createUserModel,
} from './support/repository-test-helpers';

describe('UserWriteRepositoryImpl', () => {
  describe('조회', () => {
    let em: EntityManagerMock;
    let repository: UserWriteRepositoryImpl;

    beforeEach(() => {
      em = createEntityManagerMock();
      repository = new UserWriteRepositoryImpl(em as any);
    });

    it('ID로 사용자를 조회하고 활성 비밀번호 credential을 함께 반환한다', async () => {
      const user = createUserEntity();
      const disabledPassword = createUserCredentialEntity({
        id: 'cred-disabled',
        enabled: false,
      });
      const activePassword = createUserCredentialEntity({
        id: 'cred-active',
        secretHash: 'active-secret',
      });
      attachCredentials(user, [disabledPassword, activePassword]);
      em.findOne.mockResolvedValue(user);

      const result = await repository.findById('user-1');

      expect(result?.id).toBe('user-1');
      expect(result?.passwordCredential?.secretHash).toBe('active-secret');
      expect(em.findOne).toHaveBeenCalledWith(
        UserOrmEntity,
        { id: 'user-1' },
        { populate: ['tenant', 'credentials'] },
      );
    });

    it('email 우선, 없으면 phone으로 연락처 조회를 fallback한다', async () => {
      const emailUser = createUserEntity({ email: 'alice@example.com' });
      const phoneUser = createUserEntity({
        id: 'user-2',
        email: null,
        phone: '01099998888',
      });
      attachCredentials(emailUser, [createUserCredentialEntity()]);
      attachCredentials(phoneUser, [createUserCredentialEntity({ id: 'cred-2' })]);

      em.findOne
        .mockResolvedValueOnce(emailUser)
        .mockResolvedValueOnce(phoneUser);

      await expect(
        repository.findByContact('tenant-1', {
          email: 'alice@example.com',
          phone: '01099998888',
        }),
      ).resolves.toMatchObject({ id: 'user-1' });

      await expect(
        repository.findByContact('tenant-1', { phone: '01099998888' }),
      ).resolves.toMatchObject({ id: 'user-2' });
    });

    it('목록 조회 시 total과 사용자 목록을 반환한다', async () => {
      const first = createUserEntity();
      const second = createUserEntity({ id: 'user-2', username: 'bob' });
      attachCredentials(first, [createUserCredentialEntity()]);
      attachCredentials(second, [createUserCredentialEntity({ id: 'cred-2' })]);
      em.findAndCount.mockResolvedValue([[first, second], 2]);

      const result = await repository.list({
        tenantId: 'tenant-1',
        page: 2,
        limit: 2,
      });

      expect(result.total).toBe(2);
      expect(result.items.map((item) => item.username)).toEqual(['alice', 'bob']);
      expect(em.findAndCount).toHaveBeenCalledWith(
        UserOrmEntity,
        { tenant: 'tenant-1' },
        { populate: ['tenant', 'credentials'], limit: 2, offset: 2 },
      );
    });

    it('credential 타입별 조회는 활성 credential만 도메인 모델로 변환한다', async () => {
      em.find.mockResolvedValue([
        createUserCredentialEntity({
          id: 'cred-password',
          type: 'password',
          hashVersion: 2,
        }),
        createUserCredentialEntity({
          id: 'cred-totp',
          type: 'totp',
          hashAlg: 'sha256',
        }),
      ]);

      const result = await repository.findCredentialsByType('user-1', [
        'password',
        'totp',
      ]);

      expect(result.map((item) => item.type)).toEqual(['password', 'totp']);
      expect(result[0].hashVersion).toBe(2);
      expect(em.find).toHaveBeenCalledWith(UserCredentialOrmEntity, {
        user: { id: 'user-1' },
        type: { $in: ['password', 'totp'] },
        enabled: true,
      });
    });
  });

  describe('저장', () => {
    it('신규 사용자를 트랜잭션으로 저장하고 새 password credential을 만든다', async () => {
      const { em, txEm } = createTransactionalEntityManagers();
      const repository = new UserWriteRepositoryImpl(em as any);
      txEm.findOne.mockResolvedValue(null);

      await repository.save(
        createUserModel({
          id: 'user-1',
          tenantId: 'tenant-1',
          username: 'alice',
          email: 'alice@example.com',
          emailVerified: false,
          phone: '01012341234',
          phoneVerified: false,
          status: 'ACTIVE',
          passwordCredential: createUserCredentialModel({
            secretHash: 'new-secret',
          }),
        }),
      );

      expect(em.transactional).toHaveBeenCalled();
      expect(txEm.create).toHaveBeenCalledWith(
        UserOrmEntity,
        expect.objectContaining({
          id: 'user-1',
          username: 'alice',
          tenant: expect.objectContaining({ id: 'tenant-1' }),
        }),
      );
      expect(txEm.nativeUpdate).toHaveBeenCalledWith(
        UserCredentialOrmEntity,
        { user: { id: 'user-1' }, type: 'password', enabled: true },
        { enabled: false },
      );
      expect(txEm.create).toHaveBeenCalledWith(
        UserCredentialOrmEntity,
        expect.objectContaining({
          type: 'password',
          secretHash: 'new-secret',
          user: expect.objectContaining({ id: 'user-1' }),
        }),
      );
      expect(txEm.flush).toHaveBeenCalled();
    });

    it('기존 사용자는 상태와 연락처만 갱신하고 credential이 없으면 재발급하지 않는다', async () => {
      const { em, txEm } = createTransactionalEntityManagers();
      const repository = new UserWriteRepositoryImpl(em as any);
      const existing = createUserEntity({
        email: 'old@example.com',
        phone: '01011112222',
        status: 'ACTIVE',
      });
      txEm.findOne.mockResolvedValue(existing);

      await repository.save(
        createUserModel({
          id: 'user-1',
          tenantId: 'tenant-1',
          username: 'alice',
          email: 'updated@example.com',
          emailVerified: false,
          phone: null,
          phoneVerified: false,
          status: 'LOCKED',
          passwordCredential: undefined,
        }),
      );

      expect(existing.email).toBe('updated@example.com');
      expect(existing.phone).toBeUndefined();
      expect(existing.status).toBe('LOCKED');
      expect(txEm.nativeUpdate).not.toHaveBeenCalled();
      expect(txEm.flush).toHaveBeenCalled();
    });

    it('기존 credential의 enabled/hashParams를 갱신한다', async () => {
      const em = createEntityManagerMock();
      const repository = new UserWriteRepositoryImpl(em as any);
      const existing = createUserCredentialEntity({
        id: 'cred-1',
        enabled: true,
        hashParams: { rounds: 10 },
      });
      em.findOneOrFail.mockResolvedValue(existing);

      const credential = createUserCredentialModel(
        {
          type: 'password',
          enabled: false,
          hashParams: { rounds: 12 },
        },
        'cred-1',
      );

      await repository.saveCredential(credential);

      expect(existing.enabled).toBe(false);
      expect(existing.hashParams).toEqual({ rounds: 12 });
      expect(em.flush).toHaveBeenCalled();
    });

    it('username으로 사용자를 조회한다', async () => {
      const em = createEntityManagerMock();
      const repository = new UserWriteRepositoryImpl(em as any);
      const user = createUserEntity();
      attachCredentials(user, [createUserCredentialEntity()]);
      em.findOne.mockResolvedValue(user);

      const result = await repository.findByUsername('tenant-1', 'alice');

      expect(result?.username).toBe('alice');
      expect(em.findOne).toHaveBeenCalledWith(
        UserOrmEntity,
        { tenant: 'tenant-1', username: 'alice' },
        { populate: ['tenant', 'credentials'] },
      );
    });

    it('사용자가 없으면 undefined를 반환한다', async () => {
      const em = createEntityManagerMock();
      const repository = new UserWriteRepositoryImpl(em as any);
      em.findOne.mockResolvedValue(null);

      await expect(repository.findById('missing')).resolves.toBeUndefined();
      await expect(
        repository.findByUsername('tenant-1', 'missing'),
      ).resolves.toBeUndefined();
    });

    it('신규 저장 시 tenant reference를 사용한다', async () => {
      const { em, txEm } = createTransactionalEntityManagers();
      const repository = new UserWriteRepositoryImpl(em as any);
      txEm.findOne.mockResolvedValue(null);

      await repository.save(
        createUserModel({
          id: 'user-9',
          tenantId: 'tenant-9',
          username: 'charlie',
          email: null,
          emailVerified: false,
          phone: null,
          phoneVerified: false,
          status: 'ACTIVE',
          passwordCredential: createUserCredentialModel(),
        }),
      );

      expect(txEm.getReference).toHaveBeenCalledWith(TenantOrmEntity, 'tenant-9');
    });
  });
});
