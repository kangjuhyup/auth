import { Inject, Injectable } from '@nestjs/common';
import type Provider from 'oidc-provider';
import { OIDC_PROVIDER } from './oidc-provider.constants';
import {
  AccessVerifierPort,
  type AuthenticatedUser,
} from '@application/ports/access-verifier.port';

type AccessTokenLike = {
  // 0.9 계열: accountId/clientId/scope 등이 없을 수 있음
  accountId?: string;
  clientId?: string;
  scope?: string;

  // payload가 바로 있거나, 내부에 저장된 값 형태가 다를 수 있음
  payload?: any;

  // 일부 버전에서 JSON 직렬화 형태로 제공될 수 있어 대비
  toJSON?: () => any;
};

@Injectable()
export class AccessVerifierAdapter implements AccessVerifierPort {
  constructor(@Inject(OIDC_PROVIDER) private readonly provider: Provider) {}

  async verify(
    tenantId: string,
    bearerToken: string,
  ): Promise<AuthenticatedUser> {
    // ✅ 0.9에서도 가능: Provider.AccessToken.find(token)
    const at = (await (this.provider as any).AccessToken.find(bearerToken)) as
      | AccessTokenLike
      | undefined;

    if (!at) throw new Error('Unauthorized');

    // ✅ payload 추출(버전별 차이를 방어적으로 흡수)
    const payload = this.extractPayload(at);

    // ✅ 만료 체크: exp(초 단위, JWT 표준)를 우선 사용
    // oidc-provider 내부 모델 payload에는 exp가 있는 경우가 많음
    const exp = payload?.exp;
    if (typeof exp === 'number') {
      const nowSec = Math.floor(Date.now() / 1000);
      if (exp <= nowSec) throw new Error('Unauthorized');
    }
    // exp가 없다면 여기서 강제 만료 체크는 어려움(버전/저장형태 의존)
    // => 이 경우엔 "find가 살아있다"는 사실만으로는 불충분할 수 있으니
    // 토큰 설계에서 exp가 반드시 들어가도록 하는 것을 권장.

    // ✅ 멀티테넌트 바인딩(토큰 payload에 tenantId를 넣는 전략이 있을 때만 유효)
    if (payload?.tenantId && payload.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }

    // ✅ userId 추출 (accountId -> sub 순)
    const userId = at.accountId ?? payload?.sub ?? payload?.accountId;
    if (!userId) throw new Error('Unauthorized');

    return {
      userId: String(userId),
      clientId: at.clientId ?? payload?.client_id ?? payload?.clientId,
      scope: at.scope ?? payload?.scope,
    };
  }

  private extractPayload(at: AccessTokenLike): any {
    // 1) payload 필드가 있으면 우선 사용
    if (at.payload && typeof at.payload === 'object') return at.payload;

    // 2) toJSON이 있다면 거기서 payload 후보를 찾음
    const json = typeof at.toJSON === 'function' ? at.toJSON() : null;
    if (json?.payload && typeof json.payload === 'object') return json.payload;

    // 3) 어떤 버전에서는 전체 json 자체가 payload 비슷한 형태일 수 있음
    if (json && typeof json === 'object') return json;

    return null;
  }
}
