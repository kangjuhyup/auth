import { IdentityProviderMapper } from '@infrastructure/repositories/mapper/identity-provider.mapper';
import { IdentityProviderOrmEntity } from '@infrastructure/mikro-orm/entities';

describe('IdentityProviderMapper', () => {
  it('ORM 엔티티를 도메인 모델로 변환한다', () => {
    const entity = Object.assign(new IdentityProviderOrmEntity(), {
      id: 'idp-1',
      tenant: { id: 'tenant-1' },
      provider: 'google',
      displayName: 'Google',
      clientId: 'google-client',
      clientSecret: 'secret',
      redirectUri: 'https://app.example.com/callback',
      enabled: true,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
    });

    const domain = IdentityProviderMapper.toDomain(entity);

    expect(domain.id).toBe('idp-1');
    expect(domain.tenantId).toBe('tenant-1');
    expect(domain.provider).toBe('google');
    expect(domain.displayName).toBe('Google');
    expect(domain.clientId).toBe('google-client');
    expect(domain.clientSecret).toBe('secret');
    expect(domain.redirectUri).toBe('https://app.example.com/callback');
    expect(domain.enabled).toBe(true);
    expect(domain.createdAt).toEqual(new Date('2025-01-01'));
    expect(domain.updatedAt).toEqual(new Date('2025-01-02'));
  });

  it('nullable clientSecret도 null로 유지한다', () => {
    const entity = Object.assign(new IdentityProviderOrmEntity(), {
      id: 'idp-2',
      tenant: { id: 'tenant-1' },
      provider: 'apple',
      displayName: 'Apple',
      clientId: 'apple-client',
      clientSecret: null,
      redirectUri: 'https://app.example.com/apple/callback',
      enabled: false,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
    });

    const domain = IdentityProviderMapper.toDomain(entity);

    expect(domain.clientSecret).toBeNull();
    expect(domain.enabled).toBe(false);
  });
});
