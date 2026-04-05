/**
 * identity_provider.oauth_config JSON.
 * 비어 있으면 {@link WELL_KNOWN_IDP_OAUTH_ENDPOINTS} 기본값만 사용.
 * 커스텀 IdP는 provider 키가 내장 목록에 없을 때 여기에 URL·필드 매핑을 모두 넣어야 한다.
 */
export interface IdpOauthEndpointsConfig {
  authorizationUrl?: string;
  tokenUrl?: string;
  /** 생략 시 내장 기본. 빈 문자열이면 userinfo 호출 없이 id_token 사용 */
  userinfoUrl?: string;
  scopes?: string[];
  subField?: string;
  emailField?: string;
  extraAuthParams?: Record<string, string>;
}

/**
 * DB oauth_config 와 내장 기본값을 병합한 결과(HTTP 호출에 바로 사용).
 */
export interface IdpOauthResolvedEndpoints {
  authorization: string;
  token: string;
  userinfo: string;
  scopes: string[];
  subField: string;
  emailField?: string;
  extraAuthParams?: Record<string, string>;
}

/** provider 키별 내장 기본값 — oauth_config 와 병합 시 저장값이 우선 */
export const WELL_KNOWN_IDP_OAUTH_ENDPOINTS: Record<
  string,
  IdpOauthResolvedEndpoints
> = {
  google: {
    authorization: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    userinfo: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: ['openid', 'email', 'profile'],
    subField: 'sub',
    emailField: 'email',
    extraAuthParams: {
      prompt: 'select_account',
    },
  },
  kakao: {
    authorization: 'https://kauth.kakao.com/oauth/authorize',
    token: 'https://kauth.kakao.com/oauth/token',
    userinfo: 'https://kapi.kakao.com/v2/user/me',
    scopes: ['openid', 'account_email', 'profile_nickname'],
    subField: 'id',
    emailField: 'kakao_account.email',
  },
  naver: {
    authorization: 'https://nid.naver.com/oauth2.0/authorize',
    token: 'https://nid.naver.com/oauth2.0/token',
    userinfo: 'https://openapi.naver.com/v1/nid/me',
    scopes: [],
    subField: 'response.id',
    emailField: 'response.email',
  },
  apple: {
    authorization: 'https://appleid.apple.com/auth/authorize',
    token: 'https://appleid.apple.com/auth/token',
    userinfo: '',
    scopes: ['name', 'email'],
    subField: 'sub',
    emailField: 'email',
  },
};

export function resolveIdpOauthEndpoints(
  provider: string,
  stored: IdpOauthEndpointsConfig | null,
): IdpOauthResolvedEndpoints {
  const base = WELL_KNOWN_IDP_OAUTH_ENDPOINTS[provider];
  const s = stored ?? {};

  const authorization = s.authorizationUrl ?? base?.authorization;
  const token = s.tokenUrl ?? base?.token;
  const userinfo =
    s.userinfoUrl !== undefined ? s.userinfoUrl : (base?.userinfo ?? '');
  const scopes = s.scopes !== undefined ? s.scopes : (base?.scopes ?? []);
  const subField = s.subField ?? base?.subField;
  const emailField =
    s.emailField !== undefined ? s.emailField : base?.emailField;

  const mergedExtra: Record<string, string> = {
    ...(base?.extraAuthParams ?? {}),
    ...(s.extraAuthParams ?? {}),
  };
  const extraAuthParams = Object.keys(mergedExtra).length
    ? mergedExtra
    : undefined;

  if (!authorization || !token || subField === undefined || subField === '') {
    throw new Error(
      `IdP "${provider}": authorizationUrl, tokenUrl, subField 가 필요합니다. identity_provider.oauth_config 를 채우거나 내장 provider 키를 사용하세요.`,
    );
  }

  return {
    authorization,
    token,
    userinfo,
    scopes,
    subField,
    emailField,
    extraAuthParams,
  };
}
