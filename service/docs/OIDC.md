# OIDC Overview

이 프로젝트의 OIDC 서버는 `node-oidc-provider`를 프로토콜 엔진으로 사용하고, 우리 코드는 그 위에 멀티테넌시, 저장소, 클레임 조회, 토큰 검증 어댑터를 붙이는 형태로 구현되어 있다.

핵심 원칙:

- OAuth 2.0 / OIDC 프로토콜 처리 자체는 `node-oidc-provider`에 위임
- 우리 코드는 `service/src/infrastructure/oidc-provider/*` 에서 provider 설정과 저장소 연결만 담당
- 멀티테넌트는 path 기반 issuer 로 분리
- Security correctness > Convenience

---

# 1. Runtime Structure

관련 파일:

- [oidc-provider.module.ts](../src/infrastructure/oidc-provider/oidc-provider.module.ts)
- [oidc-provider.factory.ts](../src/infrastructure/oidc-provider/oidc-provider.factory.ts)
- [oidc-provider.config.ts](../src/infrastructure/oidc-provider/oidc-provider.config.ts)
- [oidc.middleware.ts](../src/presentation/http/oidc.middleware.ts)
- [oidc-provider.registry.ts](../src/infrastructure/oidc-provider/oidc-provider.registry.ts)
- [interaction.controller.ts](../src/presentation/controllers/interaction.controller.ts)

커스텀 Grant(`grant_type` 확장 또는 `Grant` 동의 모델) 절차는 [OIDC_CUSTOM_GRANT.md](./OIDC_CUSTOM_GRANT.md) 를 참고한다.

구성 흐름:

1. `OidcProviderModule` 이 `OIDC_PROVIDER` registry 를 생성한다.
2. registry 는 `tenantCode` 별로 `Provider` 인스턴스를 lazy 생성하고 캐시한다.
3. 요청은 `/t/:tenantCode/oidc/*` 로 들어온다.
4. `OidcDelegateMiddleware` 가 tenant prefix 를 제거한 뒤 해당 tenant provider 의 `callback()` 으로 위임한다.
5. 실제 `/authorize`, `/token`, `/userinfo`, `/revoke`, `/session/end` 같은 엔드포인트 처리는 `node-oidc-provider` 가 수행한다.

---

# 2. Tenant-aware Issuer

issuer 는 tenant 별로 분리된다.

형식:

```text
{OIDC_ISSUER}/t/{tenantCode}/oidc
```

예:

```text
http://localhost:3000/t/acme/oidc
```

즉 `acme` 테넌트의 discovery 문서와 token endpoint 는 모두 이 issuer 기준으로 노출된다.

Provider 인스턴스도 tenant 별로 분리 생성된다:

```ts
new Provider(`https://auth.example.com/t/${tenantCode}/oidc`, configuration)
```

---

# 3. Exposed OIDC Endpoints

실제 provider 엔드포인트는 tenant prefix 아래에 노출된다.

예시:

```text
/t/:tenantCode/oidc/.well-known/openid-configuration
/t/:tenantCode/oidc/auth
/t/:tenantCode/oidc/token
/t/:tenantCode/oidc/userinfo
/t/:tenantCode/oidc/revoke
/t/:tenantCode/oidc/session/end
/t/:tenantCode/oidc/interaction/:uid
```

주의:

- 실제 path 이름은 `node-oidc-provider` 기본 라우팅을 따른다.
- RP 가 참조해야 하는 canonical 경로는 discovery 문서의 각 endpoint 값을 따르는 것이 안전하다.

---

# 4. Endpoint Details

## 4.1 `/.well-known/openid-configuration`

용도:

- issuer metadata 제공
- client 가 authorization, token, userinfo, jwks, revocation, end-session endpoint 를 discovery 하는 진입점

이 프로젝트에서:

- tenant issuer 기준으로 동적으로 응답
- `OidcDelegateMiddleware` 가 tenant별 provider 로 위임

## 4.2 `/token`

용도:

- authorization code 교환
- refresh token 교환
- access token / id token 발급

이 프로젝트에서:

- 토큰 발급/검증은 `node-oidc-provider` 가 처리
- access token 형식은 `resourceIndicators.getResourceServerInfo()` 에서 결정
- `OIDC_ACCESS_TOKEN_FORMAT` 값으로 `opaque` 또는 `jwt` 선택

관련 코드:

- [oidc-provider.config.ts](../src/infrastructure/oidc-provider/oidc-provider.config.ts)

특징:

- PKCE 는 강제(`pkce.required: () => true`)
- scope 기본값은 `openid profile email`
- resource indicator 사용 시 허용된 resource origin 만 통과

## 4.3 `/userinfo`

용도:

- access token 기반 사용자 클레임 조회

이 프로젝트에서:

- 계정 조회는 `findAccount` 콜백을 통해 `UserQueryPort.findClaimsBySub()` 로 수행
- 현재 반환 클레임은 최소 집합만 사용

현재 클레임:

- `sub`
- `email`
- `email_verified`

주의:

- 민감정보나 내부 상태는 userinfo/claims 에 직접 노출하지 않음

## 4.4 `/revoke`

용도:

- RFC 7009 토큰 폐기

이 프로젝트에서:

- revocation 엔드포인트 자체는 `node-oidc-provider` 가 처리
- 저장소 정리는 OIDC adapter 가 담당
- adapter 에는 `revokeByGrantId(grantId)` 구현이 존재

관련 코드:

- [rdb-oidc.adapter.ts](../src/infrastructure/oidc-provider/adapters/rdb-oidc.adapter.ts)
- [redis-oidc.adapter.ts](../src/infrastructure/oidc-provider/adapters/redis-oidc.adapter.ts)
- [hybrid-oidc.adapter.ts](../src/infrastructure/oidc-provider/adapters/hybrid-oidc.adapter.ts)

의미:

- 같은 grant 에 속한 토큰/세션 정리가 adapter 레벨에서 수행된다.

## 4.5 `/session/end`

용도:

- RP-initiated logout / end-session 처리

이 프로젝트에서:

- endpoint 자체는 provider 기본 기능으로 노출
- 세션/쿠키 정리는 provider 가 수행
- post logout redirect 동작은 client metadata 의 `postLogoutRedirectUris` 와 연결된다.

주의:

- custom logout UI 나 후처리 로직은 현재 별도 구현되어 있지 않다.

## 4.6 `/interaction/:uid`

용도:

- 로그인/동의(consent) 같은 interaction 세션 처리

이 프로젝트에서:

- `features.devInteractions` 는 `false` — 기본 개발용 UI 비활성화
- 대신 커스텀 `InteractionController` 가 login/consent 화면과 처리 로직을 구현

관련 코드:

- [interaction.controller.ts](../src/presentation/controllers/interaction.controller.ts)
- [interaction-login.view.ts](../src/presentation/views/interaction-login.view.ts)
- [interaction-consent.view.ts](../src/presentation/views/interaction-consent.view.ts)

엔드포인트 구성:

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/t/:tenantCode/interaction/:uid` | 인터랙션 진입점. prompt 에 따라 로그인 또는 동의 화면 렌더링 |
| POST | `/t/:tenantCode/interaction/:uid/login` | 사용자명/비밀번호 제출. `UserQueryPort.authenticate()` 로 검증 |
| POST | `/t/:tenantCode/interaction/:uid/consent` | 동의 승인. Grant 생성/갱신 후 provider 에 반환 |
| GET | `/t/:tenantCode/interaction/:uid/abort` | 인터랙션 취소. `access_denied` 에러 반환 |

흐름:

1. provider 가 authorization 요청을 받으면 `interactions.url` 콜백으로 interaction 경로를 결정
2. `InteractionController.showInteraction()` 이 prompt 종류를 확인
3. `login` prompt → 서버 사이드 렌더링 로그인 폼 반환
4. `consent` prompt → 요청 스코프를 표시하는 동의 화면 반환 (missingScopes 가 없으면 자동 승인)
5. 로그인 성공 시 `provider.interactionFinished()` 로 accountId 전달
6. 동의 승인 시 Grant 를 생성하고 grantId 를 provider 에 반환

---

# 5. How This Project Uses `node-oidc-provider`

## 5.1 Provider 생성

[oidc-provider.factory.ts](../src/infrastructure/oidc-provider/oidc-provider.factory.ts) 에서 provider 를 생성한다.

특징:

- `oidc-provider` 는 ESM-only 이므로 dynamic import loader 사용
- tenant 별 issuer 로 provider 인스턴스 생성
- config 는 `buildOidcConfiguration(...)` 로 조립

## 5.2 Provider 설정

[oidc-provider.config.ts](../src/infrastructure/oidc-provider/oidc-provider.config.ts) 에서 현재 다음을 설정한다.

- `interactions.url` — tenant 별 interaction 경로 생성 (`/t/{tenantCode}/interaction/{uid}`)
- `loadExistingGrant` — `skipConsent` 가 설정된 클라이언트에 대해 동의 없이 Grant 자동 생성
- `pkce.required: () => true`
- `scopes: ['openid', 'profile', 'email']`
- `cookies.keys`
- `ttl`
- `adapter`
- `findAccount`
- `features.resourceIndicators`

## 5.3 Storage Adapter

provider persistence 는 adapter factory 로 연결된다. adapter 는 `oidc-provider` 표준 인터페이스를 구현한다:

```ts
interface Adapter {
  upsert(id: string, payload: AdapterPayload, expiresIn: number): Promise<void>;
  find(id: string): Promise<AdapterPayload | undefined>;
  findByUid(uid: string): Promise<AdapterPayload | undefined>;
  findByUserCode(userCode: string): Promise<AdapterPayload | undefined>;
  consume(id: string): Promise<void>;
  destroy(id: string): Promise<void>;
  revokeByGrantId(grantId: string): Promise<void>;
}
```

> `expiresIn` 은 반드시 `number` 타입이다.

환경변수:

```env
OIDC_ADAPTER_DRIVER=rdb|redis|hybrid
```

### RDB Adapter

- 모든 모델을 RDBMS에 저장
- 완전 영속성 보장, 캐시 계층 없음
- 장점: 구조 단순, 데이터 유실 없음
- 단점: 고트래픽 시 DB 병목 가능
- 권장 환경: 내부 시스템, 저/중간 트래픽

### Redis Adapter

- 모든 모델을 Redis에 저장, TTL 기반 자동 만료
- 장점: 매우 빠른 조회, DB 부하 없음
- 단점: Redis 장애 시 인증 불가, 재시작 시 세션 유실
- 권장 환경: 완전 Stateless 구조, 세션 유실 허용 환경

### Hybrid Adapter (권장)

- RDB = 권위 저장소(Source of Truth), Redis = 캐시 계층

**Write-through 전략:**

```ts
await rdb.upsert(...)   // RDB 먼저 기록
await cache.upsert(...) // Redis는 best-effort (실패해도 전체 실패 아님)
```

**Cache-First Read:**

```
cache.find(id) → miss → rdb.find(id) → cache backfill
```

**Negative Cache (DB 폭격 방지):**

존재하지 않는 토큰 반복 조회 시 짧은 TTL negative cache를 저장한다.

```
invalid token → RDB miss → negative cache (3초)
```

**TTL Margin 전략:**

Redis TTL은 RDB TTL보다 약간 짧게 설정해 만료 경계 race condition을 방지한다.

```
cacheTtl = expiresIn - OIDC_CACHE_TTL_MARGIN_SEC
```

### Driver 비교

| Driver  | 안전성     | 성능       | 운영 난이도 | 권장 환경 |
|---------|-----------|-----------|------------|----------|
| rdb     | ★★★★★ | ★★☆☆☆ | 낮음 | 개발/소규모 |
| redis   | ★★☆☆☆ | ★★★★★ | 중간 | 특수 환경 |
| hybrid  | ★★★★★ | ★★★★★ | 중간 | **운영 권장** |

## 5.4 Account Lookup

`findAccount` 는 application query port 를 통해 사용자 claims 를 읽는다.

```ts
findAccount: async (ctx, sub) => {
  const tenantId = ctx.req.tenant?.id;

  const view = await accountQuery.findClaimsBySub({ tenantId, sub: String(sub) });

  return {
    accountId: String(sub),
    claims: async () => ({
      sub: view.sub,
      email: view.email,
      email_verified: view.email_verified,
    }),
  };
}
```

중요:

- Access Token이 JWT여도 DB 조회는 필요하다.
- `sub` 는 반드시 tenant 와 바인딩되어야 한다.
- 다른 tenant 의 sub 를 조회하면 안 된다.

이 설계 덕분에 provider 내부는 protocol 처리에 집중하고, 실제 사용자 정보는 application 계층에서 가져온다.

## 5.5 Resource Indicators

Access Token 발급 정책은 resource indicator 기반이다.

흐름:

1. client 가 `resource` 파라미터 제시
2. URL 을 origin 단위로 정규화
3. `ClientQueryPort.getAllowedResources()` 로 tenant/client 기준 허용 여부 확인
4. 허용된 경우에만 access token 발급
5. `OIDC_ACCESS_TOKEN_FORMAT` 에 따라 `jwt` 또는 `opaque` 결정

보안 제약:

- `https:` 만 허용
- `localhost`, `.local` 차단
- tenant 없는 요청 차단
- origin 단위 비교

---

# 6. Access Token Format

```env
OIDC_ACCESS_TOKEN_FORMAT=opaque   # 기본
OIDC_ACCESS_TOKEN_FORMAT=jwt
```

JWT Access Token 은 `resourceIndicators.getResourceServerInfo()` 에서 포맷을 반환한다:

```ts
features: {
  resourceIndicators: {
    enabled: true,
    async getResourceServerInfo(ctx, resource, client) {
      return {
        accessTokenFormat: 'jwt', // 또는 'opaque'
        audience: resource,
        scope: 'openid profile email',
      };
    }
  }
}
```

> `node-oidc-provider@9.x` 에서는 `formats.AccessToken` 대신 `resourceIndicators.getResourceServerInfo()` 에서 포맷을 반환해야 한다.

### Opaque vs JWT

| 항목 | Opaque | JWT |
|------|--------|-----|
| 검증 방식 | 서버 DB 조회 | 서명 검증 |
| 성능 | DB 의존 | Stateless |
| 보안 통제 | 서버 통제 | 토큰 유출 시 위험 증가 |
| 권장 사용 | 내부 API | 외부 API Gateway |

### 환경별 권장

| 환경 | 추천 |
|------|------|
| 내부 API | opaque |
| 외부 공개 API | jwt |
| 고트래픽 Gateway | jwt |
| 고보안 환경 | opaque + introspection |

---

# 7. Token Verification Inside This Project

외부 API 보호용 access token 검증은 provider callback 과 별도로 [access-verifier.adapter.ts](../src/infrastructure/oidc-provider/access-verifier.adapter.ts) 에서 처리한다.

동작:

- `Provider.AccessToken.find(token)` 호출
- payload 추출
- `exp` 검사
- 필요 시 `tenantId` 바인딩 검사
- `userId`, `clientId`, `scope` 반환

이는 내부 API 가 bearer token 을 해석할 때 사용하는 adapter 이며, OIDC 표준 endpoint 의 토큰 발급 로직과는 별개다.

---

# 8. Multi-tenant Security

## 8.1 Tenant Binding

모든 요청 처리 순서:

1. `/t/:tenantCode/oidc`
2. TenantMiddleware → tenant 검증
3. OIDC Delegate Middleware
4. Provider 실행

Tenant 정보는 반드시 `req.tenant` 에 주입되어야 한다.

## 8.2 Token Tenant Binding

Access Token payload 에는 tenantId 를 포함하는 것을 권장한다:

```json
{
  "sub": "user-123",
  "tenantId": "tenant-1"
}
```

검증 시 반드시 tenant 일치 여부 확인:

```ts
if (payload.tenantId !== currentTenantId) {
  throw new Error('Unauthorized');
}
```

## 8.3 Tenant Isolation 원칙

- Issuer 를 tenant 단위로 분리
- Client 는 tenant 단위로 관리
- Resource 는 tenant 단위로 검증
- Token 은 tenantId 를 반드시 포함
- `findAccount` 는 tenant 바인딩 필수

---

# 9. Environment Variables

OIDC 관련 주요 환경변수:

```env
OIDC_ISSUER=http://localhost:3000
OIDC_ADAPTER_DRIVER=hybrid
OIDC_ACCESS_TOKEN_FORMAT=opaque
OIDC_COOKIE_KEYS=dev1,dev2
OIDC_CACHE_TTL_MARGIN_SEC=5
OIDC_CACHE_NEGATIVE_TTL_SEC=3
OIDC_CACHE_BACKFILL_TTL_SEC=60
```

---

# 10. Current Limitations / TODO

## 10.1 JWKS

현재 설정:

```ts
jwks: { keys: [] }
```

JWKS signing key 를 provider 에 연동하는 부분은 아직 TODO 이다.

관련 구현(이미 존재):

- `JwksKeyRepository` — 키 저장/조회
- `JwksKeyCryptoPort` — 키 쌍 생성
- `KeyCommandHandler.rotateKeys()` — 키 로테이션 로직

남은 작업:

- `buildOidcConfiguration` 에서 `jwks.keys` 를 `JwksKeyRepository` 에서 조회한 실제 키로 채우는 연동

## ~~10.2 Client Resource Policy~~ (완료)

`ClientQueryHandler.getAllowedResources()` 가 구현되었다.

## ~~10.3 Interaction UI~~ (완료)

`InteractionController` 와 서버 사이드 렌더링 뷰(login/consent)가 구현되었다.

추가 개선 가능 사항:

- SPA 기반 interaction UI 로 전환
- 소셜 로그인(IdP) 연동 화면 추가
- MFA 인터랙션 단계 추가

## ~~10.4 Consent / revoke 연계~~ (완료)

`AuthCommandHandler.revokeConsent()` 가 구현되었다.

남은 작업:

- OIDC 표준 revocation endpoint 에서 consent 자동 정리 연계 (adapter 레벨)
- `loadExistingGrant` 에서 revoke 된 consent 를 확인하여 Grant 재생성 차단

---

# 11. Production Recommendations

### 권장 구성 (Production SaaS)

```env
OIDC_ADAPTER_DRIVER=hybrid
OIDC_ACCESS_TOKEN_FORMAT=jwt
```

- RDB = 정합성
- Redis = 캐시
- JWT = Gateway 확장성
- Resource Indicator = 안전한 audience 바인딩
- Tenant Path 기반 issuer = 완전 격리

### 운영 환경별 Driver 선택

| 환경 | 추천 Driver |
|------|------------|
| 로컬 개발 | rdb |
| 단일 노드 | rdb |
| 다중 노드 | hybrid |
| 고트래픽 SaaS | hybrid |
| 완전 캐시 기반 | redis |

### 보안 체크리스트

- Redis 는 반드시 인증 및 TLS 사용
- RDB 에는 만료 토큰 정리 정책 필요
- Hybrid 에서 Redis 는 권위 저장소가 아님
- Negative cache TTL 은 1~5초 권장
- 멀티테넌트 환경에서는 tenant 바인딩 검증 필수

---

# 12. Summary

이 프로젝트는 `node-oidc-provider` 를 프로토콜 엔진으로 사용하고, 다음을 우리 코드에서 보완한다.

- tenant-aware issuer 및 path routing
- storage adapter 선택(rdb/redis/hybrid)
- application query port 기반 account lookup
- resource indicator 검증 (`ClientQueryHandler.getAllowedResources`)
- 내부 API 용 access token 검증 adapter
- 커스텀 interaction UI (로그인/동의 화면 및 처리)
- `skipConsent` 클라이언트 대상 자동 Grant 생성
- consent 관리 및 revoke 처리

OIDC 표준 endpoint 자체는 provider 가 담당하고, 우리 코드는 멀티테넌시와 persistence, 정책, 클레임 조회, interaction 을 연결하는 구조다.
