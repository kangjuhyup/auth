# OIDC Provider 구성 가이드

이 서비스는 `node-oidc-provider` 기반의 OIDC 인증/인가 서버입니다.

스토리지 레이어는 **플러그형 Adapter 구조**로 설계되어 있으며,
운영 환경에 따라 다음 세 가지 드라이버 중 하나를 선택할 수 있습니다.

- `rdb` – RDBMS 단독
- `redis` – Redis 단독
- `hybrid` – RDB + Redis 캐시 계층 (권장)

---

# 1. 아키텍처 개요

                node-oidc-provider
                        │
                        ▼
                  AdapterFactory
                        │
                        ▼
     ┌───────────────┬───────────────┬─────────────────┐
     │     RDB       │     Redis     │     Hybrid      │
     │ (권위 저장소)  │ (메모리 저장소) │ (RDB + Cache)   │
     └───────────────┴───────────────┴─────────────────┘


Adapter는 `oidc-provider`의 표준 인터페이스를 구현합니다.

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

> `expiresIn`은 반드시 `number` 타입입니다.

---

# 2. Driver 선택

환경 변수:

```bash
OIDC_ADAPTER_DRIVER=rdb
OIDC_ADAPTER_DRIVER=redis
OIDC_ADAPTER_DRIVER=hybrid
```

---

# 3. RDB Adapter

## 개요

- 모든 모델을 RDBMS에 저장
- 완전 영속성 보장
- 캐시 계층 없음

## 장점

- 구조 단순
- 데이터 유실 없음
- 운영 안정성 높음

## 단점

- 토큰/세션 조회 시 DB 부하 증가
- 고트래픽 환경에서 병목 가능

## 권장 환경

- 내부 시스템
- 저/중간 트래픽
- Redis 미사용 환경

---

# 4. Redis Adapter

## 개요

- 모든 모델을 Redis에 저장
- TTL 기반 자동 만료
- 완전 인메모리 구조

## 장점

- 매우 빠른 조회
- DB 부하 없음

## 단점

- Redis 장애 시 인증 불가
- 영속성 없음
- 재시작 시 세션 유실

## 권장 환경

- 완전 Stateless 구조
- Redis Cluster 환경
- 세션 유실 허용 가능 환경

---

# 5. Hybrid Adapter (권장)

## 개요

- RDB = 권위 저장소 (Source of Truth)
- Redis = 캐시 계층
- Write-through 전략
- Cache-first read
- Negative cache 지원

---

## 5.1 Write-through 전략

```ts
await rdb.upsert(...)
await cache.upsert(...)
```

- 항상 RDB가 먼저 기록됩니다.
- Redis는 best-effort입니다.
- Redis 실패는 전체 실패로 간주하지 않습니다.

---

## 5.2 Cache-First Read

```ts
cache.find(id)
  → miss
  → rdb.find(id)
  → cache backfill
```

---

## 5.3 Negative Cache (DB 폭격 방지)

존재하지 않는 토큰 반복 조회 시 DB 부하를 막기 위해 짧은 TTL negative cache를 저장합니다.

```
invalid token → RDB miss → negative cache (3초)
```

---

## 5.4 TTL Margin 전략

Redis TTL은 RDB TTL보다 약간 짧게 설정됩니다.

```
cacheTtl = expiresIn - margin
```

이는 만료 경계 조건(race condition)을 방지하기 위함입니다.

---

# 6. Driver 설정 예시

```ts
buildOidcAdapterFactory({
  driver: process.env.OIDC_ADAPTER_DRIVER as OidcAdapterDriver,
  em: entityManager,
  redis: redisClient,
});
```

---

# 7. TTL 정책

`oidc-provider` 설정 예:

```ts
ttl: {
  AccessToken: 3600,
  RefreshToken: 1209600,
  Session: 1209600,
}
```

Adapter는 반드시 `expiresIn: number`를 전달받습니다.

---

# 8. 운영 권장 사항

| 환경 | 추천 Driver |
|------|------------|
| 로컬 개발 | rdb |
| 단일 노드 | rdb |
| 다중 노드 | hybrid |
| 고트래픽 SaaS | hybrid |
| 완전 캐시 기반 | redis |

---

# 9. 보안 고려사항

- Redis는 반드시 인증 및 TLS 사용
- RDB에는 만료 토큰 정리 정책 필요
- Hybrid에서 Redis는 권위 저장소가 아님
- Negative cache TTL은 1~5초 권장
- 멀티테넌트 환경에서는 tenant 바인딩 검증 필수

---

# 10. 설계 원칙

- RDB는 항상 정합성의 기준
- Redis는 성능 최적화 계층
- 캐시 실패는 기능 실패가 아니다
- 토큰 만료는 TTL 기준으로 처리
- 멀티테넌트 토큰은 tenantId 바인딩 필수

---

# 11. Driver 비교

| Driver  | 안전성 | 성능 | 운영 난이도 | 권장도 |
|----------|--------|------|--------------|--------|
| rdb      | ★★★★★ | ★★☆☆☆ | 낮음 | 개발/소규모 |
| redis    | ★★☆☆☆ | ★★★★★ | 중간 | 특수 환경 |
| hybrid   | ★★★★★ | ★★★★★ | 중간 | ★★★★★ |

---

# 12. 멀티테넌트 구조 (Path 기반)

이 서비스는 Path 기반 멀티테넌트 구조를 사용합니다.

```
/t/{tenantCode}/oidc/authorize
/t/{tenantCode}/oidc/token
/t/{tenantCode}/oidc/userinfo
```

## 12.1 Issuer 전략

각 테넌트는 고유 Issuer를 가집니다.

```
https://auth.example.com/t/{tenantCode}/oidc
```

예:

```
https://auth.example.com/t/acme/oidc
https://auth.example.com/t/tenant-a/oidc
```

OIDC Provider는 Tenant별로 별도 인스턴스를 생성하여 격리합니다.

```ts
new Provider(`https://auth.example.com/t/${tenantCode}/oidc`, configuration)
```

---

# 13. Access Token 포맷 (Opaque / JWT)

Access Token은 환경 변수로 제어됩니다.

```bash
OIDC_ACCESS_TOKEN_FORMAT=opaque
OIDC_ACCESS_TOKEN_FORMAT=jwt
```

## 13.1 동작 방식

JWT Access Token은 `resourceIndicators` 기능을 통해 제어됩니다.

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

> `node-oidc-provider@9.x`에서는 `formats.AccessToken` 대신
> `resourceIndicators.getResourceServerInfo()`에서 포맷을 반환해야 합니다.

---

# 14. Resource 검증 전략 (보안 중요)

Access Token은 반드시 "허용된 리소스 서버"에만 발급되어야 합니다.

## 14.1 검증 흐름

1. `resource`를 URL로 파싱
2. HTTPS 여부 확인
3. origin 단위 정규화
4. Client가 해당 origin을 허용하는지 조회
5. 허용되지 않으면 `invalid_target` 에러

```ts
const allowed = await clientQuery.getAllowedResources({
  tenantId,
  clientId: client.clientId,
});

if (!allowed.includes(origin)) {
  throw new Error('invalid_target');
}
```

## 14.2 보안 체크

- http 금지 (https만 허용)
- localhost 차단 (운영 환경)
- 내부망 도메인 차단
- origin 단위 비교

---

# 15. findAccount 동작

`findAccount`는 JWT/opaque와 무관하게 `sub` 기반으로 계정을 조회합니다.

```ts
findAccount: async (ctx, sub) => {
  const tenantId = ctx.req.tenant?.id;

  const view = await accountQuery.findClaimsBySub({
    tenantId,
    sub: String(sub),
  });

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

## 중요

- Access Token이 JWT여도 DB 조회는 필요합니다.
- `sub`는 반드시 tenant와 바인딩되어야 합니다.
- 다른 tenant의 sub를 조회하면 안 됩니다.

---

# 16. 멀티테넌트 보안 원칙

## 16.1 Tenant Binding

모든 요청은 다음 순서로 처리됩니다:

1. `/t/:tenantCode/oidc`
2. TenantMiddleware → tenant 검증
3. OIDC Delegate Middleware
4. Provider 실행

Tenant 정보는 반드시:

```
req.tenant
```

에 주입되어야 합니다.

---

## 16.2 Token Tenant Binding

Access Token payload에는 tenantId를 포함하는 것을 권장합니다.

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

---

# 17. Opaque vs JWT 차이

| 항목 | Opaque | JWT |
|------|--------|------|
| 검증 방식 | 서버 DB 조회 | 서명 검증 |
| 성능 | DB 의존 | Stateless |
| 보안 통제 | 서버 통제 | 토큰 유출 시 위험 증가 |
| 권장 사용 | 내부 API | 외부 API Gateway |

---

# 18. 운영 권장 Access Token 전략

| 환경 | 추천 |
|------|------|
| 내부 API | opaque |
| 외부 공개 API | jwt |
| 고트래픽 Gateway | jwt |
| 고보안 환경 | opaque + introspection |

---

# 19. Tenant 격리 전략

- Issuer를 tenant 단위로 분리
- Client는 tenant 단위로 관리
- Resource는 tenant 단위로 검증
- Token은 tenantId를 반드시 포함
- findAccount는 tenant 바인딩 필수

---

# 20. 최종 권장 구성 (Production SaaS)

```
OIDC_ADAPTER_DRIVER=hybrid
OIDC_ACCESS_TOKEN_FORMAT=jwt
```

- RDB = 정합성
- Redis = 캐시
- JWT = Gateway 확장성
- Resource Indicator = 안전한 audience 바인딩
- Tenant Path 기반 issuer = 완전 격리

---

# 21. 설계 철학

- 멀티테넌트는 완전 격리되어야 한다.
- 토큰은 반드시 리소스에 바인딩되어야 한다.
- 캐시는 권위 저장소가 아니다.
- JWT는 편의성, Opaque는 통제력이다.
- Hybrid는 안정성과 성능의 균형이다.

---

# 요약

이 OIDC Provider는 다음을 만족합니다:

- 멀티테넌트 완전 격리
- JWT / Opaque 선택 가능
- RDB / Redis / Hybrid 선택 가능
- Resource 기반 보안 강화
- Negative cache 기반 DB 보호
- Production SaaS 대응 가능 구조