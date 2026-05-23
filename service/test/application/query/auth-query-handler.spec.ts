import { AuthQueryHandler } from '@application/queries/handlers/auth-query.handler';
import type {
  UserQueryPort,
  UserProfileView,
} from '@application/queries/ports/user-query.port';
import type { ConsentRepository } from '@domain/repositories/consent.repository';
import type { UserIdentityRepository } from '@domain/repositories/user-identity.repository';
import { ConsentModel } from '@domain/models/consent';
import { UserIdentityModel } from '@domain/models/user-identity';

function makeProfileView(status = 'ACTIVE'): UserProfileView {
  return {
    userId: 'user-1',
    tenantId: 'tenant-1',
    username: 'testuser',
    email: 'user@example.com',
    emailVerified: true,
    phone: undefined,
    phoneVerified: false,
    status: status as any,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };
}

function createMockUserQuery(): jest.Mocked<UserQueryPort> {
  return {
    findProfile: jest.fn().mockResolvedValue(makeProfileView()),
    findClaimsBySub: jest.fn().mockResolvedValue(null),
    findByUsername: jest.fn().mockResolvedValue(null),
    authenticate: jest.fn().mockResolvedValue(null),
    getMfaMethods: jest.fn().mockResolvedValue([]),
    verifyMfa: jest.fn().mockResolvedValue(false),
  };
}

function createMockConsentRepo(): jest.Mocked<ConsentRepository> {
  return {
    findByTenantUserClient: jest.fn().mockResolvedValue(null),
    listAllByUser: jest.fn().mockResolvedValue([]),
    listByUser: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    save: jest.fn().mockResolvedValue(null as any),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockUserIdentityRepo(): jest.Mocked<UserIdentityRepository> {
  return {
    findByProviderSub: jest.fn().mockResolvedValue(null),
    findByIdForUser: jest.fn().mockResolvedValue(null),
    listByUser: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

describe('AuthQueryHandler', () => {
  let handler: AuthQueryHandler;
  let userQuery: jest.Mocked<UserQueryPort>;
  let consentRepo: jest.Mocked<ConsentRepository>;
  let userIdentityRepo: jest.Mocked<UserIdentityRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    userQuery = createMockUserQuery();
    consentRepo = createMockConsentRepo();
    userIdentityRepo = createMockUserIdentityRepo();
    handler = new AuthQueryHandler(userQuery, consentRepo, userIdentityRepo);
  });

  describe('getProfile', () => {
    it('user 없음 → UserNotFound 에러', async () => {
      userQuery.findProfile.mockResolvedValue(null);

      await expect(handler.getProfile('tenant-1', 'user-1')).rejects.toThrow(
        'UserNotFound',
      );
    });

    it('WITHDRAWN 상태 → UserWithdrawn 에러', async () => {
      userQuery.findProfile.mockResolvedValue(makeProfileView('WITHDRAWN'));

      await expect(handler.getProfile('tenant-1', 'user-1')).rejects.toThrow(
        'UserWithdrawn',
      );
    });

    it('성공 → ProfileResponse 매핑', async () => {
      const view = makeProfileView('ACTIVE');
      userQuery.findProfile.mockResolvedValue(view);

      const result = await handler.getProfile('tenant-1', 'user-1');

      expect(result).toMatchObject({
        id: 'user-1',
        username: 'testuser',
        email: 'user@example.com',
        emailVerified: true,
        phone: null,
        phoneVerified: false,
        status: 'ACTIVE',
      });
    });
  });

  describe('getConsents', () => {
    it('동의 없음 → 빈 배열', async () => {
      consentRepo.listAllByUser.mockResolvedValue([]);

      const result = await handler.getConsents('tenant-1', 'user-1');

      expect(result).toEqual([]);
    });

    it('성공 → ConsentResponse 배열 매핑', async () => {
      const grantedAt = new Date('2024-06-01');
      const consent = new ConsentModel(
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          clientRefId: 'client-ref-1',
          clientId: 'client-1',
          clientName: 'My App',
          grantedScopes: 'openid profile',
          grantedAt,
        },
        'consent-1',
      );
      consentRepo.listAllByUser.mockResolvedValue([consent]);

      const result = await handler.getConsents('tenant-1', 'user-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        clientId: 'client-1',
        clientName: 'My App',
        grantedScopes: 'openid profile',
        grantedAt,
      });
    });

    it('clientId 없으면 clientRefId를 사용하고 clientName은 Unknown', async () => {
      const consent = new ConsentModel(
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          clientRefId: 'ref-only',
          grantedScopes: 'openid',
          grantedAt: new Date(),
        },
        'consent-2',
      );
      consentRepo.listAllByUser.mockResolvedValue([consent]);

      const result = await handler.getConsents('tenant-1', 'user-1');

      expect(result[0].clientId).toBe('ref-only');
      expect(result[0].clientName).toBe('Unknown');
    });
  });

  describe('getIdentityLinks', () => {
    it('사용자 IdP 연결 목록을 응답으로 매핑한다', async () => {
      const linkedAt = new Date('2025-01-01T00:00:00.000Z');
      userIdentityRepo.listByUser.mockResolvedValue([
        new UserIdentityModel(
          {
            tenantId: 'tenant-1',
            userId: 'user-1',
            provider: 'google',
            providerSub: 'sub-1',
            email: 'user@example.com',
            profileJson: { name: 'User' },
            linkedAt,
          },
          'identity-1',
        ),
      ]);

      const result = await handler.getIdentityLinks('tenant-1', 'user-1');

      expect(userIdentityRepo.listByUser).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
      );
      expect(result).toEqual([
        {
          id: 'identity-1',
          provider: 'google',
          email: 'user@example.com',
          linkedAt,
        },
      ]);
    });
  });
});
