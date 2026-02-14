import { TenantModel } from '@domain/models/tenant';

describe('TenantModel', () => {
  it('코드와 이름으로 테넌트를 생성한다', () => {
    const tenant = new TenantModel({ code: 'acme', name: 'Acme Corp' });

    expect(tenant.code).toBe('acme');
    expect(tenant.name).toBe('Acme Corp');
  });

  it('id를 지정하여 생성할 수 있다', () => {
    const tenant = new TenantModel(
      { code: 'acme', name: 'Acme Corp' },
      'tenant-1',
    );

    expect(tenant.id).toBe('tenant-1');
  });

  it('changeName으로 이름을 변경한다', () => {
    const tenant = new TenantModel({ code: 'acme', name: 'Acme Corp' });

    tenant.changeName('New Acme');

    expect(tenant.name).toBe('New Acme');
  });

  it('setPersistence로 영속성 메타데이터를 설정한다', () => {
    const tenant = new TenantModel({ code: 'acme', name: 'Acme Corp' });
    const now = new Date();

    tenant.setPersistence('tenant-1', now, now);

    expect(tenant.id).toBe('tenant-1');
    expect(tenant.createdAt).toBe(now);
    expect(tenant.updatedAt).toBe(now);
  });
});
