import './support/mock-mikro-orm-core';

import { IdentityProviderRepositoryImpl } from '@infrastructure/repositories/identity-provider.repository.impl';
import { UserIdentityRepositoryImpl } from '@infrastructure/repositories/user-identity.repository.impl';
import { ConsentRepositoryImpl } from '@infrastructure/repositories/consent.repository.impl';
import { ClientAuthPolicyRepositoryImpl } from '@infrastructure/repositories/client-auth-policy.repository.impl';
import { TenantConfigRepositoryImpl } from '@infrastructure/repositories/tenant-config.repository.impl';
import { JwksKeyRepositoryImpl } from '@infrastructure/repositories/jwks-key.repository.impl';
import { EventRepositoryImpl } from '@infrastructure/repositories/event.repository.impl';
import { IdentityProviderOrmEntity } from '@infrastructure/mikro-orm/entities/identity-provider';
import { UserIdentityOrmEntity } from '@infrastructure/mikro-orm/entities/user-identity';
import { ConsentOrmEntity } from '@infrastructure/mikro-orm/entities/consent';
import { ClientAuthPolicyOrmEntity } from '@infrastructure/mikro-orm/entities/client-auth-policy';
import { TenantConfigOrmEntity } from '@infrastructure/mikro-orm/entities/tenant-config';
import { JwksKeyOrmEntity } from '@infrastructure/mikro-orm/entities/jwks-key';
import { EventOrmEntity } from '@infrastructure/mikro-orm/entities/event';
import { TenantOrmEntity } from '@infrastructure/mikro-orm/entities/tenant';
import { ClientOrmEntity } from '@infrastructure/mikro-orm/entities/client';
import { UserOrmEntity } from '@infrastructure/mikro-orm/entities/user';
import {
  EntityManagerMock,
  asLoadedRef,
  createClientAuthPolicyEntity,
  createClientAuthPolicyModel,
  createClientEntity,
  createConsentEntity,
  createConsentModel,
  createEntityManagerMock,
  createEventEntity,
  createEventModel,
  createIdentityProviderEntity,
  createJwksKeyEntity,
  createJwksKeyModel,
  createTenantConfigEntity,
  createTenantConfigModel,
  createTenantEntity,
  createUserEntity,
  createUserIdentityEntity,
  createUserIdentityModel,
} from './support/repository-test-helpers';

describe('Identity And Config Repository Implementations', () => {
  let em: EntityManagerMock;

  beforeEach(() => {
    em = createEntityManagerMock();
  });

  describe('IdentityProviderRepositoryImpl', () => {
    it('tenant와 provider로 IdP를 조회한다', async () => {
      const repository = new IdentityProviderRepositoryImpl(em as any);
      const entity = createIdentityProviderEntity();
      em.findOne.mockResolvedValue(entity);

      await expect(
        repository.findByTenantAndProvider('tenant-1', 'google'),
      ).resolves.toMatchObject({
        id: 'idp-1',
        tenantId: 'tenant-1',
        provider: 'google',
        enabled: true,
      });
      expect(em.findOne).toHaveBeenCalledWith(
        IdentityProviderOrmEntity,
        { tenant: { id: 'tenant-1' }, provider: 'google' },
        { populate: ['tenant'] },
      );
    });

    it('활성화된 IdP 목록만 반환한다', async () => {
      const repository = new IdentityProviderRepositoryImpl(em as any);
      em.find.mockResolvedValue([
        createIdentityProviderEntity(),
        createIdentityProviderEntity({
          id: 'idp-2',
          provider: 'naver',
          displayName: 'Naver',
        }),
      ]);

      const items = await repository.listEnabledByTenant('tenant-1');

      expect(items.map((item) => item.provider)).toEqual(['google', 'naver']);
      expect(em.find).toHaveBeenCalledWith(
        IdentityProviderOrmEntity,
        { tenant: { id: 'tenant-1' }, enabled: true },
        { populate: ['tenant'] },
      );
    });
  });

  describe('UserIdentityRepositoryImpl', () => {
    it('provider/sub 조합으로 사용자 식별자를 조회한다', async () => {
      const repository = new UserIdentityRepositoryImpl(em as any);
      const entity = createUserIdentityEntity();
      em.findOne.mockResolvedValue(entity);

      await expect(
        repository.findByProviderSub('tenant-1', 'google', 'provider-sub-1'),
      ).resolves.toMatchObject({
        id: 'user-identity-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        provider: 'google',
      });
      expect(em.findOne).toHaveBeenCalledWith(
        UserIdentityOrmEntity,
        {
          tenant: { id: 'tenant-1' },
          provider: 'google',
          providerSub: 'provider-sub-1',
        },
        { populate: ['tenant', 'user'] },
      );
    });

    it('신규 사용자 식별자를 저장한다', async () => {
      const repository = new UserIdentityRepositoryImpl(em as any);
      em.persist.mockImplementation((entity: any) => {
        entity.id = 'user-identity-2';
        return { flush: em.flush };
      });

      const saved = await repository.save(
        createUserIdentityModel({
          providerSub: 'provider-sub-2',
          email: 'second@example.com',
        }),
      );

      expect(saved.id).toBe('user-identity-2');
      expect(saved.providerSub).toBe('provider-sub-2');
      expect(em.getReference).toHaveBeenCalledWith(TenantOrmEntity, 'tenant-1');
      expect(em.getReference).toHaveBeenCalledWith(UserOrmEntity, 'user-1');
    });

    it('기존 사용자 식별자의 프로필을 갱신한다', async () => {
      const repository = new UserIdentityRepositoryImpl(em as any);
      const existing = createUserIdentityEntity();
      em.findOneOrFail.mockResolvedValue(existing);

      const saved = await repository.save(
        createUserIdentityModel(
          {
            email: 'updated@example.com',
            profileJson: { locale: 'en-US' },
          },
          'user-identity-1',
        ),
      );

      expect(saved.email).toBe('updated@example.com');
      expect(existing.profileJson).toEqual({ locale: 'en-US' });
      expect(em.flush).toHaveBeenCalled();
    });
  });

  describe('ConsentRepositoryImpl', () => {
    it('tenant/user/client 조합으로 동의를 조회한다', async () => {
      const repository = new ConsentRepositoryImpl(em as any);
      const entity = createConsentEntity();
      em.findOne.mockResolvedValue(entity);

      await expect(
        repository.findByTenantUserClient('tenant-1', 'user-1', 'client-ref-1'),
      ).resolves.toMatchObject({
        id: 'consent-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        clientRefId: 'client-ref-1',
      });
      expect(em.findOne).toHaveBeenCalledWith(
        ConsentOrmEntity,
        {
          tenant: { id: 'tenant-1' },
          user: { id: 'user-1' },
          client: { id: 'client-ref-1' },
        },
        { populate: ['tenant', 'user', 'client'] },
      );
    });

    it('사용자의 활성 동의 목록과 페이지네이션 목록을 반환한다', async () => {
      const repository = new ConsentRepositoryImpl(em as any);
      em.find.mockResolvedValue([
        createConsentEntity(),
        createConsentEntity({ id: 'consent-2' }),
      ]);
      em.findAndCount.mockResolvedValue([
        [createConsentEntity(), createConsentEntity({ id: 'consent-2' })],
        2,
      ]);

      const allItems = await repository.listAllByUser('tenant-1', 'user-1');
      const paged = await repository.listByUser({
        tenantId: 'tenant-1',
        userId: 'user-1',
        page: 1,
        limit: 10,
      });

      expect(allItems).toHaveLength(2);
      expect(paged.total).toBe(2);
      expect(em.find).toHaveBeenCalledWith(
        ConsentOrmEntity,
        {
          tenant: { id: 'tenant-1' },
          user: { id: 'user-1' },
          revokedAt: null,
        },
        { populate: ['tenant', 'user', 'client'] },
      );
    });

    it('신규 동의를 저장한다', async () => {
      const repository = new ConsentRepositoryImpl(em as any);
      em.persist.mockImplementation((entity: any) => {
        entity.id = 'consent-2';
        return { flush: em.flush };
      });

      const saved = await repository.save(
        createConsentModel({ grantedScopes: 'openid profile email' }),
      );

      expect(saved.id).toBe('consent-2');
      expect(saved.grantedScopes).toBe('openid profile email');
      expect(em.getReference).toHaveBeenCalledWith(TenantOrmEntity, 'tenant-1');
      expect(em.getReference).toHaveBeenCalledWith(UserOrmEntity, 'user-1');
      expect(em.getReference).toHaveBeenCalledWith(
        ClientOrmEntity,
        'client-ref-1',
      );
    });

    it('기존 동의를 갱신하고 삭제한다', async () => {
      const repository = new ConsentRepositoryImpl(em as any);
      const existing = createConsentEntity();
      em.findOneOrFail.mockResolvedValue(existing);

      const saved = await repository.save(
        createConsentModel(
          {
            grantedScopes: 'openid',
            revokedAt: new Date('2025-01-10T00:00:00.000Z'),
          },
          'consent-1',
        ),
      );

      expect(saved.grantedScopes).toBe('openid');
      expect(existing.revokedAt).toEqual(new Date('2025-01-10T00:00:00.000Z'));

      await repository.delete('consent-1');

      expect(em.remove).toHaveBeenCalledWith(existing);
    });
  });

  describe('ClientAuthPolicyRepositoryImpl', () => {
    it('클라이언트 참조 ID로 인증 정책을 조회한다', async () => {
      const repository = new ClientAuthPolicyRepositoryImpl(em as any);
      const entity = createClientAuthPolicyEntity();
      em.findOne.mockResolvedValue(entity);

      await expect(
        repository.findByClientRefId('client-ref-1'),
      ).resolves.toMatchObject({
        id: 'client-auth-policy-1',
        tenantId: 'tenant-1',
        clientRefId: 'client-ref-1',
      });
    });

    it('신규 정책을 저장하고 기존 정책을 갱신한다', async () => {
      const repository = new ClientAuthPolicyRepositoryImpl(em as any);
      em.persist.mockImplementation((entity: any) => {
        entity.id = 'client-auth-policy-2';
        return { flush: em.flush };
      });

      const created = await repository.save(
        createClientAuthPolicyModel({ mfaRequired: true }),
      );

      expect(created.id).toBe('client-auth-policy-2');
      expect(created.mfaRequired).toBe(true);
      expect(em.getReference).toHaveBeenCalledWith(TenantOrmEntity, 'tenant-1');
      expect(em.getReference).toHaveBeenCalledWith(
        ClientOrmEntity,
        'client-ref-1',
      );

      const existing = createClientAuthPolicyEntity();
      em.findOneOrFail.mockResolvedValue(existing);

      const updated = await repository.save(
        createClientAuthPolicyModel(
          {
            allowedAuthMethods: ['password', 'webauthn'],
            requireAuthTime: true,
          },
          'client-auth-policy-1',
        ),
      );

      expect(updated.allowedAuthMethods).toEqual(['password', 'webauthn']);
      expect(existing.requireAuthTime).toBe(true);
    });

    it('클라이언트 정책을 삭제한다', async () => {
      const repository = new ClientAuthPolicyRepositoryImpl(em as any);
      const entity = createClientAuthPolicyEntity();
      em.findOne.mockResolvedValue(entity);

      await repository.deleteByClientRefId('client-ref-1');

      expect(em.findOne).toHaveBeenCalledWith(ClientAuthPolicyOrmEntity, {
        client: { id: 'client-ref-1' },
      });
      expect(em.remove).toHaveBeenCalledWith(entity);
    });
  });

  describe('TenantConfigRepositoryImpl', () => {
    it('tenant ID로 설정을 조회한다', async () => {
      const repository = new TenantConfigRepositoryImpl(em as any);
      const entity = createTenantConfigEntity();
      em.findOne.mockResolvedValue(entity);

      await expect(
        repository.findByTenantId('tenant-1'),
      ).resolves.toMatchObject({
        tenantId: 'tenant-1',
        signupPolicy: 'open',
        accessTokenTtlSec: 3600,
      });
    });

    it('기존 설정을 갱신하고 없으면 새로 생성한다', async () => {
      const repository = new TenantConfigRepositoryImpl(em as any);
      const existing = createTenantConfigEntity();
      em.findOne.mockResolvedValueOnce(existing);

      const updated = await repository.save(
        createTenantConfigModel({
          requirePhoneVerify: true,
          extra: { policies: { allowSignup: false } },
        }),
      );

      expect(updated.requirePhoneVerify).toBe(true);
      expect(existing.extra).toEqual({ policies: { allowSignup: false } });

      em.findOne.mockResolvedValueOnce(null);
      em.persist.mockImplementation((entity: any) => {
        entity.tenant = createTenantEntity({ id: 'tenant-1' });
        return { flush: em.flush };
      });

      const created = await repository.save(
        createTenantConfigModel({ brandName: 'Created Brand' }),
      );

      expect(created.brandName).toBe('Created Brand');
      expect(em.getReference).toHaveBeenCalledWith(TenantOrmEntity, 'tenant-1');
    });
  });

  describe('JwksKeyRepositoryImpl', () => {
    it('활성 키 목록만 조회한다', async () => {
      const repository = new JwksKeyRepositoryImpl(em as any);
      em.find.mockResolvedValue([
        createJwksKeyEntity(),
        createJwksKeyEntity({ kid: 'kid-2' }),
      ]);

      const items = await repository.findActiveByTenantId('tenant-1');

      expect(items.map((item) => item.kid)).toEqual(['kid-1', 'kid-2']);
      expect(em.find).toHaveBeenCalledWith(
        JwksKeyOrmEntity,
        { tenant: { id: 'tenant-1' }, status: 'active' },
        { populate: ['tenant'] },
      );
    });

    it('단일 키를 신규 저장하거나 기존 키를 갱신한다', async () => {
      const repository = new JwksKeyRepositoryImpl(em as any);
      em.findOne.mockResolvedValueOnce(null);

      await repository.save(createJwksKeyModel({ kid: 'kid-2' }));

      expect(em.getReference).toHaveBeenCalledWith(TenantOrmEntity, 'tenant-1');
      expect(em.persist).toHaveBeenCalledWith(
        expect.objectContaining({ kid: 'kid-2' }),
      );

      const existing = createJwksKeyEntity();
      em.findOne.mockResolvedValueOnce(existing);

      await repository.save(
        createJwksKeyModel({
          kid: 'kid-1',
          status: 'rotated',
          expiresAt: new Date('2025-01-11T00:00:00.000Z'),
        }),
      );

      expect(existing.status).toBe('rotated');
      expect(existing.expiresAt).toEqual(new Date('2025-01-11T00:00:00.000Z'));
      expect(em.flush).toHaveBeenCalled();
    });

    it('여러 키를 한 번에 upsert한다', async () => {
      const repository = new JwksKeyRepositoryImpl(em as any);
      const existing = createJwksKeyEntity({ kid: 'kid-1' });
      em.findOne.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);

      await repository.saveMany([
        createJwksKeyModel({ kid: 'kid-1', status: 'revoked' }),
        createJwksKeyModel({ kid: 'kid-2' }),
      ]);

      expect(existing.status).toBe('revoked');
      expect(em.persist).toHaveBeenCalledWith(
        expect.objectContaining({ kid: 'kid-2' }),
      );
      expect(em.flush).toHaveBeenCalled();
    });
  });

  describe('EventRepositoryImpl', () => {
    it('필터와 페이지네이션을 적용해 이벤트를 조회한다', async () => {
      const repository = new EventRepositoryImpl(em as any);
      em.findAndCount.mockResolvedValue([
        [
          createEventEntity(),
          createEventEntity({
            id: 'event-2',
            action: 'DELETE',
            occurredAt: new Date('2025-01-06T00:00:00.000Z'),
          }),
        ],
        2,
      ]);

      const result = await repository.list({
        tenantId: 'tenant-1',
        userId: 'user-1',
        category: 'AUTH',
        action: 'LOGIN',
        page: 2,
        limit: 2,
      });

      expect(result.total).toBe(2);
      expect(result.items.map((item) => item.id)).toEqual([
        'event-1',
        'event-2',
      ]);
      expect(em.findAndCount).toHaveBeenCalledWith(
        EventOrmEntity,
        {
          tenant: { id: 'tenant-1' },
          category: 'AUTH',
          action: 'LOGIN',
          user: { id: 'user-1' },
        },
        {
          populate: ['tenant', 'user', 'client'],
          limit: 2,
          offset: 2,
          orderBy: { occurredAt: 'DESC' },
        },
      );
    });

    it('이벤트를 저장한다', async () => {
      const repository = new EventRepositoryImpl(em as any);

      await repository.save(
        createEventModel({
          action: 'UPDATE',
          success: false,
          reason: 'denied',
        }),
      );

      expect(em.getReference).toHaveBeenCalledWith(TenantOrmEntity, 'tenant-1');
      expect(em.getReference).toHaveBeenCalledWith(UserOrmEntity, 'user-1');
      expect(em.getReference).toHaveBeenCalledWith(
        ClientOrmEntity,
        'client-ref-1',
      );
      expect(em.persist).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          success: false,
          reason: 'denied',
        }),
      );
    });

    it('선택 관계가 없는 이벤트도 저장한다', async () => {
      const repository = new EventRepositoryImpl(em as any);

      await repository.save(
        createEventModel({
          userId: null,
          clientId: null,
          category: 'SYSTEM',
          action: 'OTHER',
        }),
      );

      expect(em.getReference).toHaveBeenCalledTimes(1);
      const persisted = em.persist.mock.calls[0][0];
      expect(persisted.user).toBeUndefined();
      expect(persisted.client).toBeUndefined();
    });
  });
});
