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

  function makeClientWithMalformedAllowlist(value: unknown): ClientModel {
    const client = makeClient();
    Object.defineProperty(client, 'introspectionResources', { value });
    return client;
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

  it.each([
    ['null context', null, { clientId: 'orders-api' }, { kind: 'AccessToken' }],
    [
      'null request',
      { req: null },
      { clientId: 'orders-api' },
      { kind: 'AccessToken' },
    ],
    [
      'whitespace tenant id',
      { req: { tenant: { id: '   ' } } },
      { clientId: 'orders-api' },
      { kind: 'AccessToken' },
    ],
    [
      'numeric tenant id',
      { req: { tenant: { id: 42 } } },
      { clientId: 'orders-api' },
      { kind: 'AccessToken' },
    ],
    [
      'null client',
      { req: { tenant: { id: 'tenant-1' } } },
      null,
      { kind: 'AccessToken' },
    ],
    [
      'empty client id',
      { req: { tenant: { id: 'tenant-1' } } },
      { clientId: '' },
      { kind: 'AccessToken' },
    ],
    [
      'whitespace client id',
      { req: { tenant: { id: 'tenant-1' } } },
      { clientId: '   ' },
      { kind: 'AccessToken' },
    ],
    [
      'numeric client id',
      { req: { tenant: { id: 'tenant-1' } } },
      { clientId: 42 },
      { kind: 'AccessToken' },
    ],
    [
      'null token',
      { req: { tenant: { id: 'tenant-1' } } },
      { clientId: 'orders-api' },
      null,
    ],
    [
      'scalar token',
      { req: { tenant: { id: 'tenant-1' } } },
      { clientId: 'orders-api' },
      'AccessToken',
    ],
  ])(
    '%s shape는 repository 조회 없이 거부한다',
    async (_name, ctx, client, token) => {
      const clientRepository = makeRepository();
      const policy = createIntrospectionAllowedPolicy(clientRepository);

      await expect(
        policy(ctx as any, client as any, token as any),
      ).resolves.toBe(false);
      expect(clientRepository.findByClientId).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['missing audience', undefined],
    ['null audience', null],
    ['numeric scalar audience', 42],
    ['boolean scalar audience', false],
    ['object audience', { resource: 'https://api.example.com' }],
    ['empty string audience', ''],
    ['whitespace-only audience', '   '],
    ['leading-whitespace audience', ' https://api.example.com'],
    ['trailing-whitespace audience', 'https://api.example.com '],
    ['empty audience array', []],
    ['mixed audience array', ['https://api.example.com/orders', 42]],
    [
      'object-member audience array',
      ['https://api.example.com/orders', { resource: 'orders' }],
    ],
    ['empty-member audience array', ['https://api.example.com/orders', '']],
    [
      'whitespace-member audience array',
      ['https://api.example.com/orders', ' https://other.example.com'],
    ],
  ])('%s는 repository 조회 전에 거부한다', async (_name, audience) => {
    const clientRepository = makeRepository();
    const policy = createIntrospectionAllowedPolicy(clientRepository);

    await expect(
      policy(
        { req: { tenant: { id: 'tenant-1' } } } as any,
        { clientId: 'orders-api' } as any,
        { kind: 'AccessToken', aud: audience } as any,
      ),
    ).resolves.toBe(false);
    expect(clientRepository.findByClientId).not.toHaveBeenCalled();
  });

  it('object audience를 문자열로 coercion하지 않고 repository 조회 전에 거부한다', async () => {
    const coercion = jest.fn(() => 'https://api.example.com');
    const clientRepository = makeRepository();
    const policy = createIntrospectionAllowedPolicy(clientRepository);

    await expect(
      policy(
        { req: { tenant: { id: 'tenant-1' } } } as any,
        { clientId: 'orders-api' } as any,
        {
          kind: 'AccessToken',
          aud: { toString: coercion },
        } as any,
      ),
    ).resolves.toBe(false);
    expect(coercion).not.toHaveBeenCalled();
    expect(clientRepository.findByClientId).not.toHaveBeenCalled();
  });

  it.each([
    [
      'valid와 malformed URL가 섞인 audience array',
      ['https://api.example.com/orders', 'not-a-resource-origin'],
    ],
    [
      'valid와 HTTP가 섞인 audience array',
      ['https://api.example.com/orders', 'http://other.example.com'],
    ],
  ])('%s는 전체를 repository 조회 전에 거부한다', async (_name, aud) => {
    const clientRepository = makeRepository();
    const policy = createIntrospectionAllowedPolicy(clientRepository);

    await expect(
      policy(
        { req: { tenant: { id: 'tenant-1' } } } as any,
        { clientId: 'orders-api' } as any,
        { kind: 'AccessToken', aud } as any,
      ),
    ).resolves.toBe(false);

    expect(clientRepository.findByClientId).not.toHaveBeenCalled();
  });

  it.each([
    ['null allowlist', null],
    ['scalar allowlist', 'https://api.example.com'],
    ['object allowlist', { resource: 'https://api.example.com' }],
    ['non-string member', ['https://api.example.com', 42]],
  ])(
    '%s shape의 allowlist는 거부한다',
    async (_name, introspectionResources) => {
      const policy = createIntrospectionAllowedPolicy(
        makeRepository(
          makeClientWithMalformedAllowlist(introspectionResources),
        ),
      );

      await expect(
        policy(
          { req: { tenant: { id: 'tenant-1' } } } as any,
          { clientId: 'orders-api' } as any,
          { kind: 'AccessToken', aud: 'https://api.example.com/orders' } as any,
        ),
      ).resolves.toBe(false);
    },
  );

  it.each([
    [
      'malformed URL member',
      ['https://api.example.com', 'not-a-resource-origin'],
    ],
    ['HTTP member', ['https://api.example.com', 'http://other.example.com']],
    ['localhost member', ['https://api.example.com', 'https://localhost']],
    [
      '.local member',
      ['https://api.example.com', 'https://orders.internal.local'],
    ],
    [
      'non-normalized host member',
      ['https://api.example.com', 'https://OTHER.example.com'],
    ],
    [
      'path-bearing member',
      ['https://api.example.com', 'https://other.example.com/orders'],
    ],
    [
      'trailing-slash member',
      ['https://api.example.com', 'https://other.example.com/'],
    ],
    [
      'default-port member',
      ['https://api.example.com', 'https://other.example.com:443'],
    ],
    [
      'duplicate member',
      ['https://api.example.com', 'https://api.example.com'],
    ],
    ['empty corrupt member', ['https://api.example.com', '']],
    ['whitespace corrupt member', ['https://api.example.com', '   ']],
  ])(
    '%s가 포함된 allowlist 전체를 fail closed 처리한다',
    async (_name, introspectionResources) => {
      const policy = createIntrospectionAllowedPolicy(
        makeRepository(makeClient({ introspectionResources })),
      );

      await expect(
        policy(
          { req: { tenant: { id: 'tenant-1' } } } as any,
          { clientId: 'orders-api' } as any,
          { kind: 'AccessToken', aud: 'https://api.example.com/orders' } as any,
        ),
      ).resolves.toBe(false);
    },
  );
});
