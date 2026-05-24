import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { randomBytes } from 'node:crypto';

export type MockOidcProfile = {
  sub: string;
  email?: string;
  [key: string]: unknown;
};

type AuthorizationCode = {
  clientId: string;
  redirectUri: string;
  profile: MockOidcProfile;
};

export class MockOidcIdpServer {
  readonly clientId = 'mock-idp-client';
  readonly clientSecret = 'mock-idp-secret';

  private readonly codes = new Map<string, AuthorizationCode>();
  private readonly accessTokens = new Map<string, MockOidcProfile>();
  private server: Server | undefined;
  private profile: MockOidcProfile = {
    sub: 'mock-subject-1',
    email: 'mock-user@example.test',
  };

  private constructor() {}

  static async start(): Promise<MockOidcIdpServer> {
    const idp = new MockOidcIdpServer();
    await idp.listen();
    return idp;
  }

  get origin(): string {
    const address = this.server?.address();
    if (!address || typeof address === 'string') {
      throw new Error('Mock OIDC IdP server is not listening');
    }

    return `http://127.0.0.1:${address.port}`;
  }

  setProfile(profile: MockOidcProfile): void {
    this.profile = profile;
  }

  reset(): void {
    this.codes.clear();
    this.accessTokens.clear();
    this.profile = {
      sub: 'mock-subject-1',
      email: 'mock-user@example.test',
    };
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

    if (req.method === 'GET' && url.pathname === '/authorize') {
      this.authorize(url, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/token') {
      await this.token(req, res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/userinfo') {
      this.userinfo(req, res);
      return;
    }

    this.json(res, 404, { error: 'not_found' });
  }

  private authorize(url: URL, res: ServerResponse): void {
    const clientId = url.searchParams.get('client_id');
    const redirectUri = url.searchParams.get('redirect_uri');
    const state = url.searchParams.get('state');
    const responseType = url.searchParams.get('response_type');

    if (clientId !== this.clientId || responseType !== 'code' || !redirectUri) {
      this.json(res, 400, { error: 'invalid_authorization_request' });
      return;
    }

    const code = randomBytes(16).toString('hex');
    this.codes.set(code, {
      clientId,
      redirectUri,
      profile: { ...this.profile },
    });

    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set('code', code);
    if (state) {
      callbackUrl.searchParams.set('state', state);
    }

    res.statusCode = 302;
    res.setHeader('Location', callbackUrl.toString());
    res.end();
  }

  private async token(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const body = new URLSearchParams(await this.readBody(req));
    const code = body.get('code') ?? '';
    const clientId = body.get('client_id');
    const clientSecret = body.get('client_secret');
    const redirectUri = body.get('redirect_uri');
    const grantType = body.get('grant_type');
    const authorizationCode = this.codes.get(code);

    if (
      grantType !== 'authorization_code' ||
      clientId !== this.clientId ||
      clientSecret !== this.clientSecret ||
      !authorizationCode ||
      authorizationCode.redirectUri !== redirectUri
    ) {
      this.json(res, 400, { error: 'invalid_grant' });
      return;
    }

    this.codes.delete(code);
    const accessToken = randomBytes(24).toString('hex');
    this.accessTokens.set(accessToken, authorizationCode.profile);

    this.json(res, 200, {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 300,
    });
  }

  private userinfo(req: IncomingMessage, res: ServerResponse): void {
    const authorization = req.headers.authorization;
    const accessToken = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : '';
    const profile = this.accessTokens.get(accessToken);

    if (!profile) {
      this.json(res, 401, { error: 'invalid_token' });
      return;
    }

    this.json(res, 200, profile);
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

  private json(
    res: ServerResponse,
    statusCode: number,
    body: Record<string, unknown>,
  ): void {
    const payload = JSON.stringify(body);
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Length', Buffer.byteLength(payload).toString());
    res.end(payload);
  }
}
