import type { ConfigService } from '@nestjs/config';
import { fetch as undiciFetch, type RequestInit, type Response } from 'undici';
import {
  RegistrationEligibilityError,
  RegistrationEligibilityPort,
  type RegistrationEligibilityClaim,
  type RegistrationEligibilityCompletion,
} from '@application/ports/registration-eligibility.port';

export type AccountRegistrationEligibilityHttpConfig = Readonly<{
  baseUrl: string;
  serviceToken: string;
  timeoutMs: number;
}>;

type FetchTransport = (input: string, init?: RequestInit) => Promise<Response>;

const MAX_RESPONSE_BYTES = 16 * 1024;

export function buildAccountRegistrationEligibilityHttpConfig(
  config: Pick<ConfigService, 'get' | 'getOrThrow'>,
): AccountRegistrationEligibilityHttpConfig | null {
  const rawBaseUrl = config
    .get<string>('ACCOUNT_REGISTRATION_BASE_URL')
    ?.trim();
  if (!rawBaseUrl) return null;

  const baseUrl = new URL(rawBaseUrl);
  if (
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash ||
    (baseUrl.protocol !== 'https:' &&
      config.get<string>('NODE_ENV') === 'production')
  ) {
    throw new Error('InvalidAccountRegistrationBaseUrl');
  }

  const serviceToken = config
    .getOrThrow<string>('ACCOUNT_REGISTRATION_SERVICE_TOKEN')
    .trim();
  if (!serviceToken || /\s/.test(serviceToken)) {
    throw new Error('InvalidAccountRegistrationServiceToken');
  }

  const configuredTimeout = Number(
    config.get<string>('ACCOUNT_REGISTRATION_TIMEOUT_MS') ?? '3000',
  );
  if (
    !Number.isInteger(configuredTimeout) ||
    configuredTimeout < 100 ||
    configuredTimeout > 10_000
  ) {
    throw new Error('InvalidAccountRegistrationTimeout');
  }

  return {
    baseUrl: baseUrl.origin,
    serviceToken,
    timeoutMs: configuredTimeout,
  };
}

export class DisabledRegistrationEligibilityAdapter extends RegistrationEligibilityPort {
  claim(params: {
    handoffId: string;
    tenantId: string;
    clientId: string;
    attemptId: string;
  }): Promise<never> {
    void params;
    return Promise.reject(new RegistrationEligibilityError('unavailable'));
  }

  complete(params: {
    registrationId: string;
    attemptId: string;
    issuer: string;
    subject: string;
  }): Promise<never> {
    void params;
    return Promise.reject(new RegistrationEligibilityError('unavailable'));
  }
}

export class AccountRegistrationEligibilityHttpAdapter extends RegistrationEligibilityPort {
  constructor(
    private readonly config: AccountRegistrationEligibilityHttpConfig,
    private readonly fetchTransport: FetchTransport = undiciFetch,
  ) {
    super();
  }

  async claim(params: {
    handoffId: string;
    tenantId: string;
    clientId: string;
    attemptId: string;
  }): Promise<RegistrationEligibilityClaim> {
    const payload = await this.post(
      '/account/internal/v1/registration-eligibilities/claim',
      params,
    );
    if (
      !isRecord(payload) ||
      !isNonEmptyString(payload.registrationId) ||
      payload.attemptId !== params.attemptId ||
      payload.status !== 'CLAIMED' ||
      !isIsoDate(payload.claimExpiresAt)
    ) {
      throw new RegistrationEligibilityError('invalid_response');
    }

    return {
      registrationId: payload.registrationId,
      attemptId: payload.attemptId,
      status: 'CLAIMED',
      claimExpiresAt: payload.claimExpiresAt,
    };
  }

  async complete(params: {
    registrationId: string;
    attemptId: string;
    issuer: string;
    subject: string;
  }): Promise<RegistrationEligibilityCompletion> {
    const payload = await this.post(
      '/account/internal/v1/registration-eligibilities/complete',
      params,
    );
    if (
      !isRecord(payload) ||
      payload.registrationId !== params.registrationId ||
      payload.status !== 'USED'
    ) {
      throw new RegistrationEligibilityError('invalid_response');
    }

    return {
      registrationId: payload.registrationId,
      status: 'USED',
    };
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchTransport(
        new URL(path, this.config.baseUrl).toString(),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.serviceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.config.timeoutMs),
        },
      );
    } catch {
      throw new RegistrationEligibilityError('unavailable');
    }

    if (response.status === 409) {
      throw new RegistrationEligibilityError('binding_conflict');
    }
    if (response.status === 410) {
      throw new RegistrationEligibilityError('expired');
    }
    if (!response.ok) {
      throw new RegistrationEligibilityError('unavailable');
    }

    const length = Number(response.headers.get('content-length') ?? '0');
    if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) {
      throw new RegistrationEligibilityError('invalid_response');
    }

    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      throw new RegistrationEligibilityError('invalid_response');
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new RegistrationEligibilityError('invalid_response');
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    Number.isFinite(Date.parse(value)) &&
    value.includes('T')
  );
}
