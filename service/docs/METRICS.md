# Operational Metrics

이 문서는 운영 관측성을 위해 제공되는 `/metrics` 엔드포인트와 현재 수집되는 메트릭을 설명한다.

메트릭은 장애 분석과 용량 추이를 빠르게 확인하기 위한 운영 신호다. 토큰, authorization code, client secret, password, raw key material 같은 민감 값은 메트릭 label이나 로그에 포함하지 않는다.

---

# 1. Endpoint

```text
GET /metrics
```

응답 형식:

```json
{
  "counters": [
    {
      "name": "login_success_total",
      "value": 12,
      "labels": {
        "tenantCode": "master"
      }
    }
  ],
  "latencies": [
    {
      "name": "token_endpoint_latency_ms",
      "count": 8,
      "sumMs": 128,
      "avgMs": 16,
      "maxMs": 41,
      "labels": {
        "tenantCode": "master"
      }
    }
  ]
}
```

구성:

- `counters`: 단조 증가 카운터. 같은 `name + labels` 조합으로 누적된다.
- `latencies`: latency summary. `count`, `sumMs`, `avgMs`, `maxMs`를 제공한다.
- `labels`: 메트릭 차원. 현재는 주로 `tenantCode`, `reason`을 사용한다.

현재 구현은 process-local in-memory snapshot이다. 프로세스 재시작 시 초기화되고, 여러 인스턴스 간 자동 집계는 하지 않는다. 운영에서 장기 보관이나 알림이 필요하면 이 포트를 Prometheus/OpenTelemetry adapter로 교체한다.

---

# 2. Counters

## 2.1 OIDC Provider

| Name                        | Labels       | Meaning                                        |
| --------------------------- | ------------ | ---------------------------------------------- |
| `provider_created_total`    | `tenantCode` | tenant별 `node-oidc-provider` 인스턴스 생성 수 |
| `provider_cache_hit_total`  | `tenantCode` | 이미 생성된 provider registry cache hit 수     |
| `provider_cache_miss_total` | `tenantCode` | provider registry cache miss 수                |

해석:

- `provider_created_total`이 짧은 시간에 급증하면 tenantCode cardinality 증가, provider 생성 실패 후 재시도, 캐시 유지 실패를 의심한다.
- `provider_cache_miss_total` 대비 `provider_cache_hit_total`이 낮으면 warm-up 이전 트래픽이거나 tenant가 과도하게 분산된 상태일 수 있다.

## 2.2 Login

| Name                  | Labels                 | Meaning                   |
| --------------------- | ---------------------- | ------------------------- |
| `login_success_total` | `tenantCode`           | interaction login 성공 수 |
| `login_failure_total` | `tenantCode`, `reason` | interaction login 실패 수 |

현재 `login_failure_total.reason` 값:

| Reason                | Meaning                            |
| --------------------- | ---------------------------------- |
| `tenant_not_found`    | 요청 tenant context가 없음         |
| `rate_limited`        | 로그인 rate limit 정책에 의해 차단 |
| `temporarily_locked`  | 계정 임시 잠금 정책에 의해 차단    |
| `invalid_credentials` | 사용자명/비밀번호 인증 실패        |
| `mfa_failed`          | MFA 검증 실패                      |

해석:

- `invalid_credentials` 급증은 credential stuffing이나 brute force 신호일 수 있다.
- `rate_limited`, `temporarily_locked` 증가는 방어 정책이 동작 중이라는 의미다. 같은 시점의 audit log와 함께 확인한다.
- `mfa_failed` 증가는 MFA 피싱, 사용자 혼선, 시간 동기화 문제를 함께 의심한다.

## 2.3 Token Endpoint

| Name                           | Labels       | Meaning                                          |
| ------------------------------ | ------------ | ------------------------------------------------ |
| `token_issued_total`           | `tenantCode` | token endpoint 성공 응답 수                      |
| `refresh_token_exchange_total` | `tenantCode` | `grant_type=refresh_token` 교환 성공 수          |
| `invalid_grant_total`          | `tenantCode` | token endpoint에서 `invalid_grant` 오류 발생 수  |
| `invalid_client_total`         | `tenantCode` | token endpoint에서 `invalid_client` 오류 발생 수 |

해석:

- `invalid_grant_total` 증가는 만료/재사용 refresh token, 잘못된 authorization code, replay 시도 가능성을 본다.
- `invalid_client_total` 증가는 client secret 오류, client auth method 불일치, 잘못된 배포 설정을 우선 확인한다.
- `refresh_token_exchange_total` 대비 `token_issued_total` 비율이 높으면 장시간 세션 중심 트래픽이다.

---

# 3. Latencies

| Name                        | Labels       | Meaning                             |
| --------------------------- | ------------ | ----------------------------------- |
| `token_endpoint_latency_ms` | `tenantCode` | token endpoint 처리 latency summary |

필드:

- `count`: 관측 횟수
- `sumMs`: latency 합계
- `avgMs`: 평균 latency
- `maxMs`: 최대 latency

해석:

- `avgMs`는 추세 확인용이다. tail latency 알림이 필요하면 histogram adapter가 필요하다.
- `maxMs`가 튀는 경우 DB, Redis, provider adapter, client lookup 경로를 함께 확인한다.

---

# 4. Security Notes

- 메트릭 label에는 token, authorization code, refresh token, client secret, password, raw key material을 절대 넣지 않는다.
- `tenantCode`는 운영상 필요한 최소 차원으로 허용한다. 사용자 식별자는 메트릭 label에 넣지 않고 audit log에서 correlationId로 추적한다.
- `/metrics`는 현재 전역 throttling에서 제외된다. 외부 노출 시 Ingress/WAF 또는 내부 네트워크 정책으로 접근을 제한한다.
- 장애 분석 시 `/metrics` 값만으로 보안 결정을 내리지 않는다. 캐시/메트릭 카운터는 non-authoritative signal이다.

---

# 5. Related Files

- [health.controller.ts](../src/presentation/controllers/health.controller.ts)
- [observability-query.handler.ts](../src/application/queries/handlers/observability-query.handler.ts)
- [operational-metrics.port.ts](../src/application/ports/operational-metrics.port.ts)
- [in-memory-operational-metrics.adapter.ts](../src/infrastructure/observability/in-memory-operational-metrics.adapter.ts)
- [oidc-provider.registry.ts](../src/infrastructure/oidc-provider/oidc-provider.registry.ts)
- [oidc-interaction.adapter.ts](../src/infrastructure/oidc-provider/oidc-interaction.adapter.ts)
