import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { createPublicKey, verify, type JsonWebKey } from 'node:crypto';

export type BackchannelLogoutClaims = {
  iss: string;
  aud: string | string[];
  sub: string;
  iat: number;
  jti: string;
  sid?: string;
  events: Record<string, Record<string, never>>;
};

type TestFetchInput = string | URL | { url: string };
type TestFetch = (
  input: TestFetchInput,
  init?: Record<string, unknown>,
) => Promise<unknown>;
type TestJwk = JsonWebKey & { alg?: string; kid?: string };

export class MockRelyingPartyServer {
  private static readonly PUBLIC_ORIGIN =
    'https://relying-party.e2e.example.test';

  private readonly notifications = new Map<string, BackchannelLogoutClaims[]>();
  private trustedJwks: TestJwk[] = [];
  private server: Server | undefined;

  private constructor() {}

  static async start(): Promise<MockRelyingPartyServer> {
    const relyingParty = new MockRelyingPartyServer();
    await relyingParty.listen();
    return relyingParty;
  }

  get origin(): string {
    const address = this.server?.address();
    if (!address || typeof address === 'string') {
      throw new Error('Mock relying party server is not listening');
    }

    return `http://127.0.0.1:${address.port}`;
  }

  logoutUri(clientId: string): string {
    return `${MockRelyingPartyServer.PUBLIC_ORIGIN}/backchannel-logout/${encodeURIComponent(clientId)}`;
  }

  interceptFetch(): () => void {
    const fetchGlobal = globalThis as unknown as { fetch: TestFetch };
    const originalFetch = fetchGlobal.fetch;

    fetchGlobal.fetch = (input, init) => {
      const requestedUrl = new URL(
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url,
      );

      if (requestedUrl.origin === MockRelyingPartyServer.PUBLIC_ORIGIN) {
        const localUrl = new URL(
          `${requestedUrl.pathname}${requestedUrl.search}`,
          this.origin,
        );
        return originalFetch(localUrl, init);
      }

      return originalFetch(input, init);
    };

    return () => {
      fetchGlobal.fetch = originalFetch;
    };
  }

  notificationsFor(clientId: string): BackchannelLogoutClaims[] {
    return [...(this.notifications.get(clientId) ?? [])];
  }

  trustJwks(keys: TestJwk[]): void {
    this.trustedJwks = keys.map((key) => ({ ...key }));
  }

  reset(): void {
    this.notifications.clear();
    this.trustedJwks = [];
  }

  async close(): Promise<void> {
    if (!this.server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.server!.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    this.server = undefined;
  }

  private async listen(): Promise<void> {
    this.server = createServer((req, res) => {
      void this.handle(req, res);
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(0, '127.0.0.1', () => {
        this.server!.off('error', reject);
        resolve();
      });
    });
  }

  private async handle(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const url = new URL(req.url ?? '/', this.origin);
    const match = /^\/backchannel-logout\/([^/]+)$/.exec(url.pathname);

    if (req.method !== 'POST' || !match) {
      this.respond(res, 404);
      return;
    }

    const body = new URLSearchParams(await this.readBody(req));
    const logoutToken = body.get('logout_token');
    const claims = logoutToken
      ? this.verifyAndDecodeClaims(logoutToken)
      : undefined;

    if (!claims) {
      this.respond(res, 400);
      return;
    }

    const clientId = decodeURIComponent(match[1]);
    const existing = this.notifications.get(clientId) ?? [];
    existing.push(claims);
    this.notifications.set(clientId, existing);
    this.respond(res, 204);
  }

  private verifyAndDecodeClaims(
    token: string,
  ): BackchannelLogoutClaims | undefined {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      return undefined;
    }

    try {
      const header = JSON.parse(
        Buffer.from(encodedHeader, 'base64url').toString('utf8'),
      ) as { alg?: string; kid?: string };
      const jwk = this.trustedJwks.find(
        (candidate) => candidate.kid === header.kid,
      );

      if (header.alg !== 'RS256' || !jwk) {
        return undefined;
      }

      const signatureValid = verify(
        'RSA-SHA256',
        Buffer.from(
          `${encodedHeader}.${encodedPayload}`,
        ) as unknown as Uint8Array<ArrayBuffer>,
        createPublicKey({ key: jwk, format: 'jwk' }),
        Buffer.from(
          encodedSignature,
          'base64url',
        ) as unknown as Uint8Array<ArrayBuffer>,
      );
      if (!signatureValid) {
        return undefined;
      }

      return JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as BackchannelLogoutClaims;
    } catch {
      return undefined;
    }
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk: string) => {
        body += chunk;
      });
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  private respond(res: ServerResponse, statusCode: number): void {
    res.statusCode = statusCode;
    res.end();
  }
}
