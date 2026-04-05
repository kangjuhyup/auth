import { UserIdentityModel } from '@domain/models/user-identity';

describe('UserIdentityModel', () => {
  it('연결된 사용자 식별자 정보를 그대로 노출한다', () => {
    const linkedAt = new Date('2025-03-01T00:00:00.000Z');
    const model = new UserIdentityModel(
      {
        tenantId: 'tenant-1',
        userId: 'user-1',
        provider: 'google',
        providerSub: 'sub-123',
        email: 'user@example.com',
        profileJson: { name: 'User', locale: 'ko-KR' },
        linkedAt,
      },
      'identity-1',
    );

    expect(model.id).toBe('identity-1');
    expect(model.tenantId).toBe('tenant-1');
    expect(model.userId).toBe('user-1');
    expect(model.provider).toBe('google');
    expect(model.providerSub).toBe('sub-123');
    expect(model.email).toBe('user@example.com');
    expect(model.profileJson).toEqual({ name: 'User', locale: 'ko-KR' });
    expect(model.linkedAt).toEqual(linkedAt);
  });

  it('nullable 필드와 persistence 메타데이터를 함께 다룬다', () => {
    const model = new UserIdentityModel({
      tenantId: 'tenant-1',
      userId: 'user-1',
      provider: 'naver',
      providerSub: 'sub-456',
      email: null,
      profileJson: null,
      linkedAt: new Date('2025-03-05T00:00:00.000Z'),
    });

    const createdAt = new Date('2025-03-06T00:00:00.000Z');
    const updatedAt = new Date('2025-03-07T00:00:00.000Z');
    model.setPersistence('identity-2', createdAt, updatedAt);

    expect(model.id).toBe('identity-2');
    expect(model.email).toBeNull();
    expect(model.profileJson).toBeNull();
    expect(model.createdAt).toEqual(createdAt);
    expect(model.updatedAt).toEqual(updatedAt);
  });
});
