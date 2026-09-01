import {
  createSafeOidcFetch,
  createValidatedLookup,
} from '@infrastructure/oidc-provider/security/safe-oidc-fetch';
import type { Configuration } from 'oidc-provider';

describe('safe OIDC fetch', () => {
  it('Node 24 provider fetch 계약과 global Request를 그대로 지원한다', async () => {
    const transport = jest.fn().mockResolvedValue(new Response(null));
    const providerFetch: NonNullable<Configuration['fetch']> =
      createSafeOidcFetch({ transport });
    const request = new Request('https://93.184.216.34/logout');

    await expect(providerFetch(request)).resolves.toBeInstanceOf(Response);
    expect(transport).toHaveBeenCalledWith(
      request,
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it.each([
    'http://public.example.com/logout',
    'https://user:password@public.example.com/logout',
    'https://localhost/logout',
    'https://127.0.0.1/logout',
    'https://2130706433/logout',
    'https://127.1/logout',
    'https://10.1.2.3/logout',
    'https://100.64.0.1/logout',
    'https://169.254.1.1/logout',
    'https://192.0.2.1/logout',
    'https://224.0.0.1/logout',
    'https://[::1]/logout',
    'https://[fc00::1]/logout',
    'https://[fe80::1]/logout',
    'https://[ff00::1]/logout',
    'https://[2001:db8::1]/logout',
    'https://[::ffff:127.0.0.1]/logout',
  ])('unsafe destination %s를 transport 전에 거부한다', async (url) => {
    const transport = jest.fn();
    const safeFetch = createSafeOidcFetch({ transport });

    await expect(safeFetch(url)).rejects.toThrow('Unsafe OIDC destination');
    expect(transport).not.toHaveBeenCalled();
  });

  it('DNS 응답 중 하나라도 private이면 연결을 거부한다', async () => {
    const lookup = createValidatedLookup(
      jest.fn().mockResolvedValue([
        { address: '93.184.216.34', family: 4 },
        { address: '10.0.0.1', family: 4 },
      ]),
    );

    await expect(runLookup(lookup, 'public.example.com')).rejects.toThrow(
      'Unsafe OIDC destination',
    );
  });

  it('검증한 public DNS 주소를 실제 연결 lookup 결과로 고정한다', async () => {
    const resolver = jest.fn().mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ]);
    const lookup = createValidatedLookup(resolver);

    await expect(runLookup(lookup, 'public.example.com', 4)).resolves.toEqual({
      address: '93.184.216.34',
      family: 4,
    });
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it('redirect를 따라가지 않고 provider에 실패 응답으로 돌려준다', async () => {
    const transport = jest
      .fn()
      .mockResolvedValue(new Response(null, { status: 302 }));
    const safeFetch = createSafeOidcFetch({ transport });

    const response = await safeFetch('https://93.184.216.34/logout', {
      method: 'POST',
      body: 'logout_token=secret-value',
    });

    expect(response.status).toBe(302);
    expect(transport).toHaveBeenCalledWith(
      'https://93.184.216.34/logout',
      expect.objectContaining({
        redirect: 'manual',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('public HTTPS 요청에는 제한된 timeout signal을 전달한다', async () => {
    const transport = jest.fn().mockImplementation(
      (_url: string | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(init.signal?.reason);
          });
        }),
    );
    const safeFetch = createSafeOidcFetch({ transport, timeoutMs: 5 });

    await expect(
      safeFetch('https://93.184.216.34/logout'),
    ).rejects.toBeDefined();
  });
});

type Lookup = ReturnType<typeof createValidatedLookup>;

function runLookup(
  lookup: Lookup,
  hostname: string,
  family = 0,
): Promise<{ address: string; family: number }> {
  return new Promise((resolve, reject) => {
    lookup(hostname, { family }, (error, address, resolvedFamily) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ address: address as string, family: resolvedFamily as number });
    });
  });
}
