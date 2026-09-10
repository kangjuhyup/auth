import { buildHttpCorsDelegate } from '@presentation/http/http-cors';

function resolve(
  delegate: ReturnType<typeof buildHttpCorsDelegate>,
  request: Record<string, unknown>,
) {
  return new Promise<Record<string, unknown>>((done, reject) => {
    delegate(request, (error, options) => {
      if (error) reject(error);
      else done(options as Record<string, unknown>);
    });
  });
}

describe('HTTP CORS policy', () => {
  const config = {
    get: jest.fn((key: string) =>
      key === 'HTTP_CORS_ORIGINS' ? 'https://admin.example.com,*' : undefined,
    ),
  };

  it('기존 Admin UI exact origin을 유지하고 wildcard 설정은 버린다', async () => {
    const external = { resolveCorsOrigin: jest.fn() };
    const delegate = buildHttpCorsDelegate(config as any, external as any);

    await expect(
      resolve(delegate, {
        url: '/t/acme/admin/clients',
        headers: { origin: 'https://admin.example.com' },
      }),
    ).resolves.toMatchObject({
      origin: 'https://admin.example.com',
      credentials: true,
    });
    await expect(
      resolve(delegate, {
        url: '/t/acme/admin/clients',
        headers: { origin: 'https://evil.example.com' },
      }),
    ).resolves.toEqual({ origin: false });
  });

  it('interaction에 묶인 client의 exact origin만 credentialed preflight를 허용한다', async () => {
    const external = {
      resolveCorsOrigin: jest
        .fn()
        .mockResolvedValue('https://login.example.com'),
    };
    const delegate = buildHttpCorsDelegate(config as any, external as any);
    const path = '/t/acme/interaction/uid_12345678/api/login';

    await expect(
      resolve(delegate, {
        url: path,
        headers: { origin: 'https://login.example.com' },
      }),
    ).resolves.toMatchObject({
      origin: 'https://login.example.com',
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
    });
    await expect(
      resolve(delegate, {
        url: path,
        headers: { origin: 'https://evil.example.com' },
      }),
    ).resolves.toEqual({ origin: false });
  });

  it('interaction 이외 경로와 invalid uid에는 동적 origin을 열지 않는다', async () => {
    const external = { resolveCorsOrigin: jest.fn() };
    const delegate = buildHttpCorsDelegate(config as any, external as any);

    await expect(
      resolve(delegate, {
        url: '/t/acme/interaction/short/api/login',
        headers: { origin: 'https://login.example.com' },
      }),
    ).resolves.toEqual({ origin: false });
    expect(external.resolveCorsOrigin).not.toHaveBeenCalled();
  });
});
