# Auth Service

OIDC 인가 서버. `node-oidc-provider` 기반으로 멀티테넌트 인증/인가를 제공한다.

---

## 기술 스택

- NestJS
- MikroORM (PostgreSQL / MySQL / MSSQL 지원)
- node-oidc-provider (OIDC 엔진)
- Clean Architecture + DDD 성격의 레이어링 + Hexagonal(Ports/Adapters)
- CQRS: Command / Query 핸들러·포트 분리 (동일 애그리거트는 ORM·리포지토리로 영속화)
- Jest (TDD)

DB 설정/마이그레이션은 `docs/DATABASE.md` 참고.

---

## 서비스의 역할

### node-oidc-provider가 담당하는 것
- Authorization / Token / UserInfo / JWKS 엔드포인트
- PKCE 검증, state/nonce 처리, grant/session/interaction 관리
- ID Token 발급/서명 (키 제공 기반)

### 서비스 코드가 담당하는 것
- 테넌트/클라이언트/키/동의/정책의 라이프사이클 관리
- 커스텀 클레임(정책 기반, 최소)
- 감사 로그 및 보안 이벤트 기록
- 캐시(Discovery/JWKS 등 공개 데이터) 및 키 로테이션 무효화
- 운영 안전성(멱등, 레이트 리밋, 관측성 확장 여지)

---

## 아키텍처 개요

`service/`는 다음 의존성 방향을 강제한다:

- `presentation → application → domain`
- `infrastructure → application → domain`

Domain은 외부 패키지에 의존하지 않는다.

---

## 디렉토리 구조

```
src/
├── domain/
│   ├── models/           # 도메인 모델(엔티티·VO 등)
│   ├── errors/           # 도메인 에러
│   └── repositories/     # 영속성 추상화(포트)
│
├── application/
│   ├── commands/         # 커맨드·핸들러·포트
│   ├── queries/          # 쿼리·핸들러·포트·MFA 전략 등
│   ├── ports/            # command/query 공용 포트(암호화·트랜잭션 등)
│   ├── dto/              # 애플리케이션 DTO
│   └── decorators/       # 예: @Transactional
│
├── infrastructure/
│   ├── oidc-provider/    # provider 부트스트랩·어댑터
│   ├── mikro-orm/        # 엔티티·마이그레이션·ORM 설정
│   ├── repositories/     # 리포지토리 구현·매퍼
│   ├── crypto/           # 비밀번호·JWKS·대칭키 등
│   ├── notification/     # 메일/SMS 채널
│   ├── redis/            # Redis 모듈
│   ├── idp/              # 외부 IdP 연동
│   ├── mfa/              # MFA 검증
│   ├── smtp/ · sms/      # 발송 어댑터
│   └── ...
│
├── presentation/
│   ├── controllers/      # admin·auth·interaction·health
│   ├── dto/                # HTTP DTO (admin·auth 등)
│   └── http/               # 미들웨어·가드·보안 헤더
│
└── main.ts
```

---

## CQRS 규칙 (현재 코드 기준)

### Command (Write)
- 커맨드 핸들러는 도메인 모델과 리포지토리(포트)를 통해 상태를 변경한다.
- 불변성·비즈니스 규칙은 도메인 모델·핸들러에서 검증한다.
- 필요 시 `@Transactional` 등으로 트랜잭션 경계를 맞춘다.

### Query (Read)
- 쿼리 핸들러는 조회 전용 포트·리포지토리(또는 읽기 모델)만 사용한다.
- 쓰기용 리포지토리로 동일 요청 안에서 우회 갱신하지 않는 것을 원칙으로 한다.

> 이벤트 소싱·이벤트 스토어·프로젝션 전용 read model 은 사용하지 않는다.  
> `event` 도메인/테이블은 감사·보안 이벤트 기록 등 **상태 저장** 용도로 둔다.

---

## 보안 원칙

- 절대 로그에 비밀번호/토큰/시크릿/키 원문을 남기지 않는다.
- PKCE는 모든 public client에 필수(S256 only).
- 키 로테이션 시 JWKS 오버랩 윈도우 유지 + 캐시 purge
- 커스텀 클레임은 최소/결정론적/정책 기반으로만 추가

---

## HTTP 보안 설정 (환경 변수)

앱 부팅 시 [`src/main.ts`](src/main.ts)에서 [`src/presentation/http/http-security.ts`](src/presentation/http/http-security.ts)로 **Helmet·trust proxy·`X-Powered-By` 제거**를 적용하고, [`src/app.module.ts`](src/app.module.ts)의 **`@nestjs/throttler`** 로 Nest 컨트롤러에 **전역 레이트 리밋**을 건다. Helmet 세부 옵션은 [`src/presentation/http/security-headers.config.ts`](src/presentation/http/security-headers.config.ts), 경로 예외는 [`src/presentation/http/app-throttler.guard.ts`](src/presentation/http/app-throttler.guard.ts)를 본다.

| 변수 | 기본(미설정 시 코드 기본값) | 설명 |
|------|---------------------------|------|
| `HTTP_TRUST_PROXY_HOPS` | (끔) | Ingress 등 프록시 뒤에서 `req.ip`·레이트 리밋이 실제 클라이언트를 보려면 hop 수(예: `1`). |
| `HTTP_HELMET_ENABLED` | `true` | `false`면 Helmet 미들웨어 비활성. |
| `HTTP_HSTS_ENABLED` | `false` | **HTTPS 프로덕션**에서만 `true`. 로컬 `http://` 에서 켜면 브라우저가 불필요하게 HTTPS 를 강요할 수 있다. |
| `HTTP_HSTS_MAX_AGE_SEC` | `15552000` | HSTS `max-age`(초). |
| `HTTP_THROTTLE_ENABLED` | `true` | `false`면 사실상 무제한(내부적으로 매우 큰 limit). E2E 는 `.env.e2e`에서 끈다. |
| `HTTP_THROTTLE_TTL_MS` | `60000` | 윈도 길이(ms). |
| `HTTP_THROTTLE_LIMIT` | `120` | 위 윈도당 허용 요청 수(컨트롤러 기준). |

**레이트 리밋 범위:** `@nestjs/throttler` 가드는 **Nest 라우트 핸들러**에만 적용된다. 가드에서 **`/t/:tenantCode/oidc/...`**, **`/health`**, **`/interaction-assets`** 는 스킵한다. OIDC 토큰 엔드포인트에 대한 공격 완화는 **Ingress/WAF** 쪽 제한을 함께 검토한다.

**Helmet:** 기본적으로 **CSP(Content-Security-Policy)는 끈다**(OIDC 리다이렉트·interaction UI 와의 충돌을 피함). 정적 화면을 엄격히 통제할 때는 `security-headers.config.ts`에서 정책을 설계한다.

`.env` 예시 키는 저장소의 `service/.env` 를 참고한다.

---

## 개발/테스트

### 테스트 전략
1) 도메인·유틸 단위 테스트
2) 커맨드/쿼리 핸들러 테스트(리포지토리·포트 목)
3) 인프라 어댑터·매퍼 테스트
4) HTTP·OIDC 통합 / E2E

### 실행
```bash
yarn workspace @auth/service test
yarn workspace @auth/service build
yarn workspace @auth/service start:dev
```
