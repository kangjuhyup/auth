import { UserIdentityMapper } from '@infrastructure/repositories/mapper/user-identity.mapper';
import { UserIdentityOrmEntity } from '@infrastructure/mikro-orm/entities';

describe('UserIdentityMapper', () => {
  it('ORM 엔티티를 도메인 모델로 변환한다', () => {
    const entity = Object.assign(new UserIdentityOrmEntity(), {
      id: 'identity-1',
      tenant: { id: 'tenant-1' },
      user: { id: 'user-1' },
      provider: 'google',
      providerSub: 'sub-123',
      email: 'user@example.com',
      profileJson: { locale: 'ko-KR' },
      linkedAt: new Date('2025-01-01'),
      createdAt: new Date('2025-01-02'),
      updatedAt: new Date('2025-01-03'),
    });

    const domain = UserIdentityMapper.toDomain(entity);

    expect(domain.id).toBe('identity-1');
    expect(domain.tenantId).toBe('tenant-1');
    expect(domain.userId).toBe('user-1');
    expect(domain.provider).toBe('google');
    expect(domain.providerSub).toBe('sub-123');
    expect(domain.email).toBe('user@example.com');
    expect(domain.profileJson).toEqual({ locale: 'ko-KR' });
    expect(domain.linkedAt).toEqual(new Date('2025-01-01'));
    expect(domain.createdAt).toEqual(new Date('2025-01-02'));
    expect(domain.updatedAt).toEqual(new Date('2025-01-03'));
  });

  it('nullable 필드도 null로 유지한다', () => {
    const entity = Object.assign(new UserIdentityOrmEntity(), {
      id: 'identity-2',
      tenant: { id: 'tenant-1' },
      user: { id: 'user-1' },
      provider: 'apple',
      providerSub: 'sub-456',
      email: null,
      profileJson: null,
      linkedAt: new Date('2025-01-01'),
      createdAt: new Date('2025-01-02'),
      updatedAt: new Date('2025-01-03'),
    });

    const domain = UserIdentityMapper.toDomain(entity);

    expect(domain.email).toBeNull();
    expect(domain.profileJson).toBeNull();
  });
});
