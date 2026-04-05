import { IdentityProviderModel } from '@domain/models/identity-provider';

describe('IdentityProviderModel', () => {
  it('생성자에 전달한 값을 그대로 노출한다', () => {
    const model = new IdentityProviderModel(
      {
        tenantId: 'tenant-1',
        provider: 'google',
        displayName: 'Google',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://app.example.com/callback',
        enabled: true,
      },
      'idp-1',
    );

    expect(model.id).toBe('idp-1');
    expect(model.tenantId).toBe('tenant-1');
    expect(model.provider).toBe('google');
    expect(model.displayName).toBe('Google');
    expect(model.clientId).toBe('client-id');
    expect(model.clientSecret).toBe('client-secret');
    expect(model.redirectUri).toBe('https://app.example.com/callback');
    expect(model.enabled).toBe(true);
  });

  it('setPersistence로 영속성 메타데이터를 설정할 수 있다', () => {
    const model = new IdentityProviderModel({
      tenantId: 'tenant-1',
      provider: 'kakao',
      displayName: 'Kakao',
      clientId: 'client-id',
      clientSecret: null,
      redirectUri: 'https://app.example.com/kakao/callback',
      enabled: false,
    });

    const createdAt = new Date('2025-01-01T00:00:00.000Z');
    const updatedAt = new Date('2025-01-02T00:00:00.000Z');

    model.setPersistence('idp-2', createdAt, updatedAt);

    expect(model.id).toBe('idp-2');
    expect(model.createdAt).toEqual(createdAt);
    expect(model.updatedAt).toEqual(updatedAt);
    expect(model.clientSecret).toBeNull();
    expect(model.enabled).toBe(false);
  });
});
