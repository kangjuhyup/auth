import { ClientModel, type ClientType } from '@domain/models/client';
import type { ClientRepository } from '@domain/repositories';
import { createIntrospectionAllowedPolicy } from '@infrastructure/oidc-provider/introspection-policy';

describe('createIntrospectionAllowedPolicy', () => {
  function makeClient(
    overrides: {
      clientId?: string;
      type?: ClientType;
      enabled?: boolean;
      tokenEndpointAuthMethod?: string;
      introspectionResources?: string[];
    } = {},
  ): ClientModel {
    return new ClientModel(
      {
        tenantId: 'tenant-1',
        clientId: overrides.clientId ?? 'orders-api',
        secretEnc: 'encrypted-secret',
        name: 'Orders API',
        type: overrides.type ?? 'service',
        enabled: overrides.enabled ?? true,
        redirectUris: [],
        grantTypes: ['client_credentials'],
        responseTypes: [],
        tokenEndpointAuthMethod:
          overrides.tokenEndpointAuthMethod ?? 'client_secret_basic',
        scope: 'orders:read',
        postLogoutRedirectUris: [],
        applicationType: 'web',
        backchannelLogoutUri: null,
        frontchannelLogoutUri: null,
        accessTokenTtlSec: null,
        refreshTokenTtlSec: null,
        allowedResources: ['https://api.example.com'],
        introspectionResources: overrides.introspectionResources ?? [
          'https://api.example.com',
        ],
        skipConsent: true,
      },
      'client-ref-1',
    );
  }

  function makeRepository(
    client: ClientModel | null = makeClient(),
  ): jest.Mocked<ClientRepository> {
    return {
      findById: jest.fn().mockResolvedValue(client),
      findByClientId: jest.fn().mockResolvedValue(client),
      list: jest.fn().mockResolvedValue({
        items: client ? [client] : [],
        total: client ? 1 : 0,
      }),
      save: jest.fn().mockImplementation(async (value) => value),
      delete: jest.fn().mockResolvedValue(undefined),
    };
  }

  it('같은 tenant의 enabled service client가 소유한 audience를 허용한다', async () => {
    const clientRepository = makeRepository();
    const policy = createIntrospectionAllowedPolicy(clientRepository);

    const allowed = await policy(
      { req: { tenant: { id: 'tenant-1' } } } as any,
      { clientId: 'orders-api' } as any,
      { kind: 'AccessToken', aud: 'https://api.example.com/orders' } as any,
    );

    expect(allowed).toBe(true);
    expect(clientRepository.findByClientId).toHaveBeenCalledWith(
      'tenant-1',
      'orders-api',
    );
  });

  it.each([
    [
      'missing tenant',
      {},
      'orders-api',
      'AccessToken',
      'https://api.example.com',
    ],
    [
      'wrong audience',
      { id: 'tenant-1' },
      'orders-api',
      'AccessToken',
      'https://other.example.com',
    ],
    [
      'missing audience',
      { id: 'tenant-1' },
      'orders-api',
      'AccessToken',
      undefined,
    ],
    [
      'HTTP audience',
      { id: 'tenant-1' },
      'orders-api',
      'AccessToken',
      'http://api.example.com',
    ],
    [
      'refresh token',
      { id: 'tenant-1' },
      'orders-api',
      'RefreshToken',
      'https://api.example.com',
    ],
  ])(
    '%s는 active metadata를 허용하지 않는다',
    async (_name, tenant, clientId, kind, aud) => {
      const policy = createIntrospectionAllowedPolicy(makeRepository());

      await expect(
        policy(
          { req: { tenant } } as any,
          { clientId } as any,
          { kind, aud } as any,
        ),
      ).resolves.toBe(false);
    },
  );

  it.each([
    ['missing caller', null],
    ['disabled caller', makeClient({ enabled: false })],
    ['public caller', makeClient({ type: 'public' })],
    ['confidential caller', makeClient({ type: 'confidential' })],
    [
      'client_secret_post caller',
      makeClient({ tokenEndpointAuthMethod: 'client_secret_post' }),
    ],
  ])('%s는 active metadata를 허용하지 않는다', async (_name, caller) => {
    const policy = createIntrospectionAllowedPolicy(makeRepository(caller));

    await expect(
      policy(
        { req: { tenant: { id: 'tenant-1' } } } as any,
        { clientId: 'orders-api' } as any,
        { kind: 'AccessToken', aud: 'https://api.example.com' } as any,
      ),
    ).resolves.toBe(false);
  });

  it('array audience 중 하나의 origin을 소유하면 허용한다', async () => {
    const policy = createIntrospectionAllowedPolicy(makeRepository());

    await expect(
      policy(
        { req: { tenant: { id: 'tenant-1' } } } as any,
        { clientId: 'orders-api' } as any,
        {
          kind: 'ClientCredentials',
          aud: ['https://other.example.com', 'https://api.example.com/orders'],
        } as any,
      ),
    ).resolves.toBe(true);
  });
});
