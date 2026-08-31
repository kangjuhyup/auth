import { lookup as dnsLookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { Agent } from 'undici';

const DEFAULT_TIMEOUT_MS = 2_500;

type ResolvedAddress = Readonly<{
  address: string;
  family: number;
}>;

type Resolver = (hostname: string) => Promise<readonly ResolvedAddress[]>;

type LookupOptions = Readonly<{
  family?: number;
}>;

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address?: string,
  family?: number,
) => void;

export type ValidatedLookup = (
  hostname: string,
  options: LookupOptions,
  callback: LookupCallback,
) => void;

type ProviderFetch = typeof globalThis.fetch;
type FetchInput = Parameters<ProviderFetch>[0];
type FetchInit = NonNullable<Parameters<ProviderFetch>[1]>;
type FetchResponse = ReturnType<ProviderFetch>;
type TransportInit = Omit<FetchInit, 'dispatcher'> & {
  dispatcher?: unknown;
};
type FetchTransport = (
  input: FetchInput,
  init?: TransportInit,
) => FetchResponse;
type DispatchingFetchInit = TransportInit & { dispatcher: Agent };

export function createValidatedLookup(
  resolver: Resolver = resolveAllAddresses,
): ValidatedLookup {
  return (hostname, options, callback) => {
    void resolver(hostname)
      .then((addresses) => {
        if (addresses.length === 0) {
          throw new Error('OIDC destination resolution failed');
        }

        for (const candidate of addresses) {
          assertGlobalAddress(candidate.address);
        }

        const requestedFamily = options.family ?? 0;
        const candidates = requestedFamily
          ? addresses.filter(
              (candidate) => candidate.family === requestedFamily,
            )
          : addresses;
        const selected = candidates[0];
        if (!selected) {
          throw new Error('OIDC destination resolution failed');
        }

        callback(null, selected.address, selected.family);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof UnsafeOidcDestinationError
            ? error.message
            : 'OIDC destination resolution failed';
        callback(new Error(message), undefined, undefined);
      });
  };
}

export function createSafeOidcFetch(
  options: {
    resolver?: Resolver;
    transport?: FetchTransport;
    timeoutMs?: number;
  } = {},
): ProviderFetch {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('OIDC fetch timeout must be a positive integer');
  }

  const lookup = createValidatedLookup(options.resolver);
  const dispatcher = new Agent({
    connect: {
      lookup: lookup as never,
      timeout: timeoutMs,
    },
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
  });
  const transport = options.transport ?? runtimeFetch;

  return async (input, init = {}) => {
    const url = parseSafeUrl(input);
    assertSafeDestination(url);

    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = init.signal
      ? combineAbortSignals(init.signal, timeoutSignal)
      : timeoutSignal;

    const dispatchingInit: DispatchingFetchInit = {
      ...init,
      dispatcher,
      redirect: 'manual',
      signal,
    };
    return transport(input, dispatchingInit);
  };
}

const runtimeFetch: FetchTransport = (input, init) => {
  // Node's global fetch and npm undici use the same runtime dispatcher API,
  // but their separately versioned declaration packages are not assignable.
  return globalThis.fetch(input, init as FetchInit);
};

function combineAbortSignals(
  first: AbortSignal,
  second: AbortSignal,
): AbortSignal {
  const controller = new AbortController();
  const abortFrom = (signal: AbortSignal) => {
    if (!controller.signal.aborted) {
      controller.abort(signal.reason);
    }
  };

  if (first.aborted) {
    abortFrom(first);
    return controller.signal;
  }
  if (second.aborted) {
    abortFrom(second);
    return controller.signal;
  }

  first.addEventListener('abort', () => abortFrom(first), { once: true });
  second.addEventListener('abort', () => abortFrom(second), { once: true });
  return controller.signal;
}

async function resolveAllAddresses(
  hostname: string,
): Promise<readonly ResolvedAddress[]> {
  return dnsLookup(hostname, { all: true, verbatim: true });
}

function parseSafeUrl(input: FetchInput): URL {
  try {
    if (typeof input === 'string') return new URL(input);
    if (input instanceof URL) return new URL(input.href);
    return new URL(input.url);
  } catch {
    throw new UnsafeOidcDestinationError();
  }
}

function assertSafeDestination(url: URL): void {
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new UnsafeOidcDestinationError();
  }

  const hostname = normalizeHostname(url.hostname);
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === 'local' ||
    hostname.endsWith('.local')
  ) {
    throw new UnsafeOidcDestinationError();
  }

  if (ipaddr.isValid(hostname)) {
    assertGlobalAddress(hostname);
  }
}

function assertGlobalAddress(address: string): void {
  const normalized = normalizeHostname(address);
  if (!ipaddr.isValid(normalized)) {
    throw new UnsafeOidcDestinationError();
  }

  const parsed = ipaddr.process(normalized);
  if (parsed.range() !== 'unicast') {
    throw new UnsafeOidcDestinationError();
  }
}

function normalizeHostname(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
}

class UnsafeOidcDestinationError extends Error {
  constructor() {
    super('Unsafe OIDC destination');
    this.name = 'UnsafeOidcDestinationError';
  }
}
