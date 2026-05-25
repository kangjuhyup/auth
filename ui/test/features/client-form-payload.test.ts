import { describe, expect, it } from 'vitest';
import { toUpdateClientDto } from '@/features/clients/clientFormPayload';

describe('client form payload', () => {
  it('수정 payload에서 생성/읽기 전용 필드를 제거한다', () => {
    const dto = toUpdateClientDto({
      id: '1',
      clientId: 'user',
      type: 'public',
      name: 'User Client',
      enabled: true,
      redirectUris: ['http://localhost:3000/callback'],
      grantTypes: ['authorization_code', 'refresh_token'],
      responseTypes: ['code'],
      tokenEndpointAuthMethod: 'none',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    expect(dto).toEqual({
      name: 'User Client',
      enabled: true,
      redirectUris: ['http://localhost:3000/callback'],
      grantTypes: ['authorization_code', 'refresh_token'],
      responseTypes: ['code'],
      tokenEndpointAuthMethod: 'none',
    });
  });
});
