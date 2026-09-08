import {
  AccountRegistrationEligibilityHttpAdapter,
  DisabledRegistrationEligibilityAdapter,
  buildAccountRegistrationEligibilityHttpConfig,
  type AccountRegistrationEligibilityHttpConfig,
} from '@infrastructure/account/account-registration-eligibility-http.adapter';
import { Response } from 'undici';

describe('AccountRegistrationEligibilityHttpAdapter', () => {
  const config: AccountRegistrationEligibilityHttpConfig = {
    baseUrl: 'https://account.example',
    serviceToken: 'service-token',
    timeoutMs: 1_000,
  };

  function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  it('Account URL이 없으면 adapter 구성을 생략해 hosted signup을 fail-closed 한다', async () => {
    const configService = {
      get: jest.fn().mockReturnValue(undefined),
      getOrThrow: jest.fn(),
    };

    expect(
      buildAccountRegistrationEligibilityHttpConfig(configService),
    ).toBeNull();
    await expect(
      new DisabledRegistrationEligibilityAdapter().claim({
        handoffId: 'handoff-1',
        tenantId: 'tenant-1',
        clientId: 'mobile-app',
        attemptId: 'tenant-1:uid-1',
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('production에서는 HTTPS Account URL과 별도 서비스 토큰을 요구한다', () => {
    const values: Record<string, string> = {
      ACCOUNT_REGISTRATION_BASE_URL: 'http://account.example',
      ACCOUNT_REGISTRATION_SERVICE_TOKEN: 'service-token',
      NODE_ENV: 'production',
    };
    const configService = {
      get: jest.fn((key: string) => values[key]),
      getOrThrow: jest.fn((key: string) => {
        const value = values[key];
        if (value === undefined) throw new Error('missing');
        return value;
      }),
    };

    expect(() =>
      buildAccountRegistrationEligibilityHttpConfig(configService),
    ).toThrow('InvalidAccountRegistrationBaseUrl');
  });

  it('claim은 확정된 경로와 Bearer 서비스 토큰 및 최소 schema만 전송한다', async () => {
    const fetchTransport = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        registrationId: 'registration-1',
        attemptId: 'tenant-1:uid-1',
        status: 'CLAIMED',
        claimExpiresAt: '2026-09-08T12:00:00.000Z',
      }),
    );
    const adapter = new AccountRegistrationEligibilityHttpAdapter(
      config,
      fetchTransport,
    );

    await expect(
      adapter.claim({
        handoffId: 'handoff-1',
        tenantId: 'tenant-1',
        clientId: 'mobile-app',
        attemptId: 'tenant-1:uid-1',
      }),
    ).resolves.toEqual({
      registrationId: 'registration-1',
      attemptId: 'tenant-1:uid-1',
      status: 'CLAIMED',
      claimExpiresAt: '2026-09-08T12:00:00.000Z',
    });

    expect(fetchTransport).toHaveBeenCalledWith(
      'https://account.example/account/internal/v1/registration-eligibilities/claim',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer service-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          handoffId: 'handoff-1',
          tenantId: 'tenant-1',
          clientId: 'mobile-app',
          attemptId: 'tenant-1:uid-1',
        }),
      }),
    );
    expect(fetchTransport.mock.calls[0][1].body).not.toMatch(
      /userId|email|phone|\bci\b|\bdi\b|terms/i,
    );
  });

  it('complete는 issuer와 subject binding만 전송한다', async () => {
    const fetchTransport = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        registrationId: 'registration-1',
        status: 'USED',
      }),
    );
    const adapter = new AccountRegistrationEligibilityHttpAdapter(
      config,
      fetchTransport,
    );

    await expect(
      adapter.complete({
        registrationId: 'registration-1',
        attemptId: 'tenant-1:uid-1',
        issuer: 'https://auth.example/t/acme/oidc',
        subject: 'auth-user-1',
      }),
    ).resolves.toEqual({
      registrationId: 'registration-1',
      status: 'USED',
    });

    expect(JSON.parse(fetchTransport.mock.calls[0][1].body)).toEqual({
      registrationId: 'registration-1',
      attemptId: 'tenant-1:uid-1',
      issuer: 'https://auth.example/t/acme/oidc',
      subject: 'auth-user-1',
    });
  });

  it.each([
    [409, 'binding_conflict'],
    [410, 'expired'],
  ])('Account HTTP %s를 안정된 오류 %s로 변환한다', async (status, code) => {
    const fetchTransport = jest
      .fn()
      .mockResolvedValue(jsonResponse(status, { error: 'ignored' }));
    const adapter = new AccountRegistrationEligibilityHttpAdapter(
      config,
      fetchTransport,
    );

    await expect(
      adapter.claim({
        handoffId: 'handoff-1',
        tenantId: 'tenant-1',
        clientId: 'mobile-app',
        attemptId: 'tenant-1:uid-1',
      }),
    ).rejects.toMatchObject({ code });
  });

  it('timeout은 service unavailable로 변환하고 응답 본문이나 토큰을 오류에 포함하지 않는다', async () => {
    const timeout = Object.assign(new Error('request aborted'), {
      name: 'AbortError',
    });
    const fetchTransport = jest.fn().mockRejectedValue(timeout);
    const adapter = new AccountRegistrationEligibilityHttpAdapter(
      config,
      fetchTransport,
    );

    const failure = await adapter
      .complete({
        registrationId: 'registration-1',
        attemptId: 'tenant-1:uid-1',
        issuer: 'https://auth.example/t/acme/oidc',
        subject: 'auth-user-1',
      })
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({ code: 'unavailable' });
    expect(String(failure)).not.toContain('service-token');
    expect(String(failure)).not.toContain('registration-1');
  });

  it('claim 응답 attemptId가 요청과 다르면 거부한다', async () => {
    const fetchTransport = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        registrationId: 'registration-1',
        attemptId: 'different-attempt',
        status: 'CLAIMED',
        claimExpiresAt: '2026-09-08T12:00:00.000Z',
      }),
    );
    const adapter = new AccountRegistrationEligibilityHttpAdapter(
      config,
      fetchTransport,
    );

    await expect(
      adapter.claim({
        handoffId: 'handoff-1',
        tenantId: 'tenant-1',
        clientId: 'mobile-app',
        attemptId: 'tenant-1:uid-1',
      }),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });
});
