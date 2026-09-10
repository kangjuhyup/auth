import { describe, expect, it } from 'vitest';
import {
  toCreateClientDto,
  toUpdateClientDto,
} from '@/features/clients/clientFormPayload';

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
      externalInteractionUiUrl: '  ',
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
      externalInteractionUiUrl: null,
    });
  });

  it('생성 payload의 외부 UI URL을 trim하고 빈 값은 생략한다', () => {
    expect(
      toCreateClientDto({
        clientId: 'web',
        name: 'Web',
        externalInteractionUiUrl: ' https://login.example.com/interaction ',
      }).externalInteractionUiUrl,
    ).toBe('https://login.example.com/interaction');

    expect(
      toCreateClientDto({
        clientId: 'web',
        name: 'Web',
        externalInteractionUiUrl: '',
      }).externalInteractionUiUrl,
    ).toBeUndefined();
  });
});
