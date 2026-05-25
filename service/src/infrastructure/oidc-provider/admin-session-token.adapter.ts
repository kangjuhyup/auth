import { Inject, Injectable } from '@nestjs/common';
import { Logging, LogLevel, NoLog } from '@kangjuhyup/rvlog';
import { AdminSessionTokenPort } from '@application/ports/admin-session-token.port';
import { OIDC_PROVIDER } from './oidc-provider.constants';
import { OidcProviderRegistry } from './oidc-provider.registry';

const ADMIN_CLIENT_ID = '__admin-portal__';
const ADMIN_SCOPE = 'openid profile';

@Injectable()
@Logging({ level: LogLevel.DEBUG })
export class AdminSessionTokenAdapter extends AdminSessionTokenPort {
  constructor(
    @Inject(OIDC_PROVIDER) private readonly registry: OidcProviderRegistry,
  ) {
    super();
  }

  async issue(params: {
    tenantCode: string;
    userId: string;
  }): Promise<{ accessToken: string; refreshToken: string } | null> {
    const provider = await this.registry.get(params.tenantCode);
    const client = await (provider as any).Client.find(ADMIN_CLIENT_ID);
    if (!client) {
      return null;
    }

    return this.issueTokens(provider, client, params.userId, ADMIN_SCOPE);
  }

  async refresh(params: { tenantCode: string; refreshToken: string }): Promise<{
    accessToken: string;
    refreshToken: string;
    userId: string;
  } | null> {
    const provider = await this.registry.get(params.tenantCode);
    const rt = await (provider as any).RefreshToken.find(params.refreshToken);
    if (!rt) {
      return null;
    }

    const exp: number | undefined =
      rt.exp ?? rt.payload?.exp ?? rt.toJSON?.()?.payload?.exp;
    if (typeof exp === 'number' && Math.floor(Date.now() / 1000) >= exp) {
      return null;
    }

    const userId: string | undefined =
      rt.accountId ?? rt.payload?.sub ?? rt.payload?.accountId;
    const clientId: string | undefined =
      rt.clientId ?? rt.payload?.clientId ?? rt.payload?.client_id;
    if (!userId || clientId !== ADMIN_CLIENT_ID) {
      return null;
    }

    const client = await (provider as any).Client.find(ADMIN_CLIENT_ID);
    if (!client) {
      return null;
    }

    await rt.destroy();

    const issued = await this.issueTokens(
      provider,
      client,
      userId,
      rt.scope ?? ADMIN_SCOPE,
    );
    if (!issued) {
      return null;
    }

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      userId,
    };
  }

  @NoLog
  async verify(params: {
    tenantCode: string;
    token: string;
  }): Promise<{ userId: string } | null> {
    const provider = await this.registry.get(params.tenantCode);
    const at = await (provider as any).AccessToken.find(params.token);
    if (!at) {
      return null;
    }

    const exp: number | undefined =
      at.exp ?? at.payload?.exp ?? at.toJSON?.()?.payload?.exp;
    if (typeof exp === 'number' && Math.floor(Date.now() / 1000) >= exp) {
      return null;
    }

    const userId: string | undefined = at.accountId ?? at.payload?.sub;
    return userId ? { userId } : null;
  }

  private async issueTokens(
    provider: any,
    client: any,
    userId: string,
    scope: string,
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    const accessToken = new provider.AccessToken({
      accountId: userId,
      client,
      scope,
    });
    const refreshToken = new provider.RefreshToken({
      accountId: userId,
      client,
      scope,
    });

    const [savedAccessToken, savedRefreshToken] = await Promise.all([
      accessToken.save(),
      refreshToken.save(),
    ]);
    if (!savedAccessToken || !savedRefreshToken) {
      return null;
    }

    return {
      accessToken: savedAccessToken,
      refreshToken: savedRefreshToken,
    };
  }
}
