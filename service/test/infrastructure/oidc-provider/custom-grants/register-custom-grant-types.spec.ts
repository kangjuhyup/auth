import { registerCustomGrantTypes } from '@infrastructure/oidc-provider/custom-grants/register-custom-grant-types';
import type {
  CustomGrantTypeContext,
  CustomGrantTypeDefinition,
} from '@infrastructure/oidc-provider/custom-grants';

describe('registerCustomGrantTypes', () => {
  const context = {
    tenantCode: 'acme',
    configService: {},
    userQuery: {},
    clientQuery: {},
    eventRepository: {},
  } as CustomGrantTypeContext;

  it('enabled custom grant를 provider에 등록한다', () => {
    const handler = jest.fn();
    const createHandler = jest.fn().mockReturnValue(handler);
    const provider = { registerGrantType: jest.fn() };
    const definitions: CustomGrantTypeDefinition[] = [
      {
        grantType: 'urn:auth:grant-type:magic_link',
        displayName: 'Magic Link',
        builtIn: false,
        enabled: true,
        allowedClientTypes: ['confidential'],
        allowedApplicationTypes: ['web'],
        requiresClientAuthentication: true,
        parameters: ['magic_token', 'scope'],
        duplicateParameters: ['resource'],
        createHandler,
      },
    ];

    const registered = registerCustomGrantTypes(
      provider as any,
      context,
      definitions,
    );

    expect(registered).toEqual(['urn:auth:grant-type:magic_link']);
    expect(createHandler).toHaveBeenCalledWith(context);
    expect(provider.registerGrantType).toHaveBeenCalledWith(
      'urn:auth:grant-type:magic_link',
      handler,
      ['magic_token', 'scope'],
      ['resource'],
    );
  });

  it('disabled custom grant는 등록하지 않는다', () => {
    const provider = { registerGrantType: jest.fn() };
    const definitions: CustomGrantTypeDefinition[] = [
      {
        grantType: 'urn:auth:grant-type:disabled',
        displayName: 'Disabled Grant',
        builtIn: false,
        enabled: false,
        allowedClientTypes: ['confidential'],
        allowedApplicationTypes: ['web'],
        requiresClientAuthentication: true,
        createHandler: jest.fn(),
      },
    ];

    const registered = registerCustomGrantTypes(
      provider as any,
      context,
      definitions,
    );

    expect(registered).toEqual([]);
    expect(provider.registerGrantType).not.toHaveBeenCalled();
  });
});
