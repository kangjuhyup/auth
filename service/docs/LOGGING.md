# Logging

서비스 HTTP 로깅은 `@kangjuhyup/rvlog-nest`를 사용한다.

관련 패키지:

- `@kangjuhyup/rvlog`
- `@kangjuhyup/rvlog-nest`

설정 위치:

- [app.module.ts](../src/app.module.ts)
- [correlation-id.middleware.ts](../src/presentation/http/correlation-id.middleware.ts)

---

# 1. Runtime Configuration

`AppModule`에서 `RvlogNestModule.forRoot()`를 통해 전역 request context middleware와 HTTP interceptor를 등록한다.

현재 설정:

```ts
RvlogNestModule.forRoot({
  logger: {
    minLevel: LogLevel.DEBUG,
    pretty: process.env.NODE_ENV !== 'production',
  },
  http: {
    context: 'HTTP',
    level: LogLevel.INFO,
    logBody: false,
    logQuery: false,
    logParams: true,
    logHeaders: false,
    logResponseBody: false,
    requestIdHeader: 'x-correlation-id',
    setResponseHeader: true,
    excludePaths: ['/health', '/ready', '/metrics', '/interaction-assets'],
  },
});
```

`RVLOG_PRETTY=true|false`를 설정하면 pretty 출력 여부를 명시적으로 제어할 수 있다.
`RVLOG_MIN_LEVEL=DEBUG|INFO|WARN|ERROR`를 설정하면 전역 최소 로그 레벨을 제어할 수 있다.

---

# 2. Correlation ID

요청 correlationId는 `x-correlation-id`를 기준으로 전파한다.

동작:

1. `rvlog-nest` request context middleware가 `x-correlation-id` 기반 requestId를 HTTP 요청 초기에 준비한다.
2. `CorrelationIdMiddleware`가 `x-correlation-id`, 이미 응답에 설정된 `x-correlation-id`, 또는 `x-request-id`를 읽는다.
3. 안전한 값이면 그대로 사용한다.
4. 없거나 안전하지 않은 값이면 ULID를 생성한다.
5. 생성/선택된 값을 `req.correlationId`, `req.headers['x-correlation-id']`, 응답 `x-correlation-id` 헤더에 설정한다.
6. Guard에서 실행되는 service/application `@Logging` 로그도 같은 requestId로 묶인다.

---

# 3. Sensitive Data Policy

HTTP 로그는 다음 값을 기록하지 않는다.

- request body
- query string
- request headers
- response body

이유:

- OIDC token endpoint body에는 `client_secret`, `code`, `refresh_token`, `password`류가 들어갈 수 있다.
- authorization query에는 `code`, `state`, `nonce` 등 상관관계에 민감한 값이 포함될 수 있다.
- authorization header와 cookie는 로그에 남기면 토큰 유출 위험이 있다.

필요한 경우에도 운영 기본값은 유지하고, 디버깅 환경에서만 짧은 시간 동안 제한적으로 켠다. production에서 body/header/query 로깅을 켜지 않는다.

요청 body 로깅이 제한적으로 켜지는 경우를 대비해 presentation DTO의 민감 필드는 `@MaskLog`를 적용한다.

마스킹 대상:

- password, currentPassword, newPassword
- token, code
- client secret, IdP client secret
- TOTP, WebAuthn, SAML callback payload
- email, phone

`@MaskLog`는 런타임 class metadata 기반으로 동작한다. 따라서 다음 조건에서만 마스킹이 보장된다.

- controller body 타입이 class DTO로 선언되어 `rvlog-nest`가 DTO prototype을 찾을 수 있는 경우
- `@Logging`/`withLogging`이 class parameter type 또는 class instance를 통해 metadata를 찾을 수 있는 경우
- 직접 `maskObject(value, undefined, DtoClass.prototype)`를 호출하는 경우

다음 경우에는 자동 마스킹을 기대하지 않는다.

- `interface`, `type`, inline object type만 사용한 payload
- DTO를 spread/serialization 하여 plain object로 변환한 뒤 직접 로깅하는 경우
- `console.log`, Nest 기본 logger, 직접 `JSON.stringify`를 사용하는 경우
- raw token/secret을 문자열 메시지에 직접 삽입하는 경우

domain에는 외부 logging decorator를 적용하지 않는다. domain/application 값은 로그 경계에서 DTO 또는 명시적 masking helper를 통해 마스킹한다.

---

# 4. Excluded Paths

다음 경로는 HTTP request log에서 제외한다.

| Path                  | Reason                     |
| --------------------- | -------------------------- |
| `/health`             | liveness probe noise 제거  |
| `/ready`              | readiness probe noise 제거 |
| `/metrics`            | metrics scrape noise 제거  |
| `/interaction-assets` | 정적 asset noise 제거      |

---

# 5. Relation To Audit Log

HTTP 로그는 운영 관측성 신호이고, 감사 로그는 보안 이벤트 기록이다.

- HTTP 로그: 요청 경로, 상태, duration, correlationId 중심
- Audit log: 관리자 작업, 보안 이벤트, token reuse 등 의미 있는 이벤트 중심

보안 판단은 HTTP 로그만으로 하지 않는다. 필요한 경우 audit log의 `correlationId`로 HTTP 요청과 연결해서 분석한다.

---

# 6. Service And Infrastructure Flow Logging

application/infrastructure 내부 흐름 추적은 `@kangjuhyup/rvlog`의 `@Logging({ level: LogLevel.DEBUG })`을 사용한다.

HTTP 요청 로그는 운영 관측성을 위해 `INFO`를 유지하고, 내부 service/infrastructure 흐름 로그만 `DEBUG`로 기록한다.

현재 적용 대상:

- `AuthQueryHandler`, `AdminQueryHandler`, `ClientQueryHandler`, `UserQueryHandler`
- `AuditRecorder`
- `RedisLoginAttemptPolicyAdapter`
- `AdminSessionTokenAdapter`
- `InfrastructureReadinessAdapter`
- `RedisSamlCacheProviderFactory`
- `AdminGuard`, `AccessGuard`, `AppThrottlerGuard`는 `ExecutionContext` 자동 로깅 대신 토큰/쿠키/헤더를 제외한 decision 로그만 수동 기록한다.
- `CorrelationIdMiddleware`, `TenantMiddleware`, `OidcDelegateMiddleware`는 request 원문 대신 선택/해결/위임 결과만 수동 기록한다.

민감정보가 primitive string 또는 plain object로 들어오는 메서드는 `@Logging` 대상에서 제외하거나 `@NoLog`를 적용한다.

`@NoLog` 적용 대상:

- password를 받는 `UserQueryHandler.authenticate`
- MFA code/WebAuthn payload를 받는 `UserQueryHandler.verifyMfa`
- bearer token을 받는 `AdminSessionTokenAdapter.verify`
- 내부 helper 및 반복 호출 mapping/check helper

`@Logging`을 새로 추가할 때는 다음을 확인한다.

- 메서드 인자에 raw password, token, authorization code, client secret, SAMLResponse, WebAuthn payload가 없어야 한다.
- Guard/Middleware/Interceptor에는 `@Logging`을 붙이지 않는다. `ExecutionContext`, `Request`, `Response`에 request header/cookie/body가 포함될 수 있으므로 안전한 필드만 수동으로 기록한다.
- HTTP interceptor 호출/완료 로그는 `rvlog-nest`가 담당한다. 별도 interceptor를 추가할 때도 request/response 객체 전체를 로그 인자로 넘기지 않는다.
- 민감 필드가 있다면 class DTO + `@MaskLog` metadata를 통해 마스킹 가능한지 확인한다.
- `interface`, `type`, inline object type은 runtime metadata가 없으므로 마스킹 보장 대상으로 보지 않는다.
- repository/mapper/metrics adapter처럼 매우 자주 호출되거나 내부 반복에서 호출되는 클래스에는 기본적으로 붙이지 않는다.
- 클래스 내부 helper가 반복 호출되면 `@NoLog`를 적용한다.
