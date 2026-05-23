import { Inject, Injectable } from '@nestjs/common';
import { AdminSessionTokenPort } from '@application/ports/admin-session-token.port';
import { OIDC_PROVIDER } from './oidc-provider.constants';
import { OidcProviderRegistry } from './oidc-provider.registry';

const ADMIN_CLIENT_ID = '__admin-portal__';

@Injectable()
export class AdminSessionTokenAdapter extends AdminSessionTokenPort {
  constructor(
    @Inject(OIDC_PROVIDER) private readonly registry: OidcProviderRegistry,
  ) {
    super();
  }

  async issue(params: {
    tenantCode: string;
    userId: string;
  }): Promise<string | null> {
    const provider = await this.registry.get(params.tenantCode);
    const client = await (provider as any).Client.find(ADMIN_CLIENT_ID);
    if (!client) {
      return null;
    }

    const at = new (provider as any).AccessToken({
      accountId: params.userId,
      client,
      scope: 'openid profile',
    });

    return at.save();
  }

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
}
