import { ClientMapper } from '@infrastructure/repositories/mapper/client.mapper';
import { ClientModel } from '@domain/models/client';
import { ClientOrmEntity } from '@infrastructure/mikro-orm/entities';

function makeOrmEntity(): ClientOrmEntity {
  return Object.assign(new ClientOrmEntity(), {
    id: '1',
    tenant: { id: 'tenant-1' },
    clientId: 'my-client',
    secretEnc: 'encrypted-secret',
    name: 'My Client',
    type: 'confidential' as const,
    enabled: true,
    redirectUris: ['https://app.example.com/callback'],
    grantTypes: ['authorization_code'],
    responseTypes: ['code'],
    tokenEndpointAuthMethod: 'client_secret_basic',
    scope: 'openid profile',
    postLogoutRedirectUris: ['https://app.example.com/logout'],
    applicationType: 'web' as const,
    backchannelLogoutUri: 'https://app.example.com/backchannel-logout',
    frontchannelLogoutUri: null,
    allowedResources: ['https://api.example.com'],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
  });
}

function makeDomainModel(id?: string): ClientModel {
  const m = new ClientModel(
    {
      tenantId: 'tenant-1',
      clientId: 'my-client',
      secretEnc: 'encrypted-secret',
      name: 'My Client',
      type: 'confidential',
      enabled: true,
      redirectUris: ['https://app.example.com/callback'],
      grantTypes: ['authorization_code'],
      responseTypes: ['code'],
      tokenEndpointAuthMethod: 'client_secret_basic',
      scope: 'openid profile',
      postLogoutRedirectUris: ['https://app.example.com/logout'],
      applicationType: 'web',
      backchannelLogoutUri: 'https://app.example.com/backchannel-logout',
      frontchannelLogoutUri: null,
      allowedResources: ['https://api.example.com'],
    },
    id,
  );
  if (id) m.setPersistence(id, new Date('2025-01-01'), new Date('2025-01-02'));
  return m;
}

describe('ClientMapper', () => {
  describe('toDomain', () => {
    it('ORM 엔티티를 도메인 모델로 변환한다', () => {
      const entity = makeOrmEntity();
      const domain = ClientMapper.toDomain(entity);

      expect(domain.id).toBe('1');
      expect(domain.tenantId).toBe('tenant-1');
      expect(domain.clientId).toBe('my-client');
      expect(domain.secretEnc).toBe('encrypted-secret');
      expect(domain.name).toBe('My Client');
      expect(domain.type).toBe('confidential');
      expect(domain.enabled).toBe(true);
      expect(domain.redirectUris).toEqual(['https://app.example.com/callback']);
      expect(domain.grantTypes).toEqual(['authorization_code']);
      expect(domain.responseTypes).toEqual(['code']);
      expect(domain.tokenEndpointAuthMethod).toBe('client_secret_basic');
      expect(domain.scope).toBe('openid profile');
      expect(domain.postLogoutRedirectUris).toEqual([
        'https://app.example.com/logout',
      ]);
      expect(domain.applicationType).toBe('web');
      expect(domain.backchannelLogoutUri).toBe(
        'https://app.example.com/backchannel-logout',
      );
      expect(domain.frontchannelLogoutUri).toBeNull();
      expect(domain.allowedResources).toEqual(['https://api.example.com']);
    });

    it('nullable 필드가 null이면 null로 매핑한다', () => {
      const entity = makeOrmEntity();
      entity.secretEnc = null;
      entity.backchannelLogoutUri = null;
      entity.frontchannelLogoutUri = null;

      const domain = ClientMapper.toDomain(entity);

      expect(domain.secretEnc).toBeNull();
      expect(domain.backchannelLogoutUri).toBeNull();
      expect(domain.frontchannelLogoutUri).toBeNull();
    });
  });

  describe('toOrm', () => {
    it('도메인 모델을 새 ORM 엔티티로 변환한다', () => {
      const domain = makeDomainModel('1');
      const entity = ClientMapper.toOrm(domain);

      expect(entity.id).toBe('1');
      expect(entity.clientId).toBe('my-client');
      expect(entity.secretEnc).toBe('encrypted-secret');
      expect(entity.name).toBe('My Client');
      expect(entity.type).toBe('confidential');
      expect(entity.applicationType).toBe('web');
      expect(entity.backchannelLogoutUri).toBe(
        'https://app.example.com/backchannel-logout',
      );
      expect(entity.frontchannelLogoutUri).toBeNull();
      expect(entity.allowedResources).toEqual(['https://api.example.com']);
    });

    it('기존 엔티티가 있으면 clientId와 type을 변경하지 않는다', () => {
      const existing = makeOrmEntity();
      existing.clientId = 'original-id';
      existing.type = 'public';

      const domain = makeDomainModel('1');
      const entity = ClientMapper.toOrm(domain, existing);

      expect(entity).toBe(existing);
      expect(entity.clientId).toBe('original-id');
      expect(entity.type).toBe('public');
    });

    it('기존 엔티티의 변경 가능 필드는 업데이트된다', () => {
      const existing = makeOrmEntity();
      existing.name = 'Old Name';
      existing.allowedResources = [];

      const domain = makeDomainModel('1');
      const entity = ClientMapper.toOrm(domain, existing);

      expect(entity.name).toBe('My Client');
      expect(entity.allowedResources).toEqual(['https://api.example.com']);
      expect(entity.secretEnc).toBe('encrypted-secret');
    });
  });
});
