# Auth Platform

멀티테넌트 인증 플랫폼으로, **OAuth 2.0 / OpenID Connect(OIDC) 서버**와 **관리 UI**, **로그인·동의용 interaction SPA**로 구성됩니다.  
`node-oidc-provider`를 프로토콜 엔진으로 사용하며, 테넌트 단위 격리, 클라이언트 정책, 외부 IdP(OAuth2) 연동, MFA 등을 제공합니다.

---

## 프로젝트 구조

```
auth/
├── service/                 # NestJS 백엔드 (OIDC + 관리 API + interaction 정적 서빙)
│   └── interaction-ui/      # 로그인·동의·MFA 화면 (Vite + React, 빌드 산출물을 Nest가 서빙)
├── ui/                      # React 관리자 콘솔 (Vite + Ant Design)
├── docker-compose.yml       # 로컬 PostgreSQL·Redis
├── docker-compose.e2e.yml   # E2E 전용 DB·Redis
└── package.json             # Yarn Workspaces 루트
```

### `service` — 백엔드

클린 아키텍처(레이어드)로 구성되어 있습니다.

```
service/src/
├── domain/           # 도메인 모델, 레포지토리 인터페이스, 도메인 이벤트
├── application/      # 커맨드/쿼리 핸들러, DTO, 포트(인터페이스)
├── infrastructure/   # DB(MikroORM), Redis, OIDC Provider, IdP/MFA 어댑터
└── presentation/     # REST 컨트롤러, HTTP 미들웨어
```

### `ui` — 관리자 콘솔

테넌트·클라이언트·사용자·권한·역할·그룹·정책·**Identity Provider** 등을 관리하는 SPA입니다. API는 테넌트 컨텍스트가 필요한 경로가 `/t/:tenantCode/admin/...` 형태입니다.

### `service/interaction-ui` — OIDC Interaction 화면

OIDC authorize 흐름 중 **로그인·동의·MFA**를 담당하는 별도 Vite 앱입니다.  
`yarn interaction-ui:build`로 `service/interaction-ui/dist`를 만든 뒤 Nest가 `index.html`과 `/interaction-assets/*` 정적 파일을 제공합니다.

---

## 주요 기능

| 영역 | 설명 |
|------|------|
| **멀티테넌시** | 테넌트별 독립 OIDC issuer (`/t/:tenantCode/oidc`) |
| **OIDC/OAuth2** | Authorization Code + **PKCE(필수)**, Token, Userinfo, Revoke, Session End |
| **클라이언트 관리** | confidential·public·service 타입, 리소스 인디케이터, 동의 생략(`skipConsent`) |
| **클라이언트 인증 정책** | 허용 로그인 방식, MFA, 세션·동의 정책 등 |
| **사용자/권한** | 사용자, 역할, 권한, 그룹 |
| **Interaction** | `/t/:tenantCode/interaction/:uid` — 비밀번호 로그인, **외부 IdP 버튼**, 동의, MFA |
| **외부 IdP** | 테넌트별 OAuth2 연동 — 내장 키(`google`, `kakao`, `naver`, `apple`) 또는 **임의 slug + `oauth_config` JSON** |
| **관리자 세션** | `POST /admin/session` — `master` 테넌트의 `SUPER_ADMIN` + OIDC admin 클라이언트로 액세스 토큰 발급 |
| **스토리지** | PostgreSQL / MySQL / MSSQL + Redis (`rdb` · `redis` · `hybrid` 어댑터) |
| **암호화** | Argon2id·PBKDF2 비밀번호 해시, 대칭 암호화, JWKS 키 관리 |

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 런타임 | Node.js 24+ |
| 백엔드 | NestJS 11 |
| ORM | MikroORM 6 |
| OIDC | node-oidc-provider 9 |
| 데이터베이스 | PostgreSQL 16 (MySQL / MSSQL 지원) |
| 캐시 | Redis 7 |
| 관리 UI | React 19, Vite, Ant Design |
| Interaction UI | React 19, Vite |
| 패키지 관리 | Yarn Berry (Workspaces + PnP) |

---

## 빠른 시작

**사전 요구:** Node.js **24** 이상 (루트 `package.json`의 `engines`, `.nvmrc`, `.node-version` 참고)

### 1. 인프라 실행

```bash
docker compose up -d
```

PostgreSQL **호스트 포트 `55432`**(컨테이너 내부 5432), Redis **`6379`** 가 열립니다.  
컨테이너 이름 예: `auth-postgres`, `auth-redis` ([`docker-compose.yml`](docker-compose.yml)).

### 2. 의존성 설치

```bash
yarn install
```

### 3. 환경 변수

[`service/.env.example`](service/.env.example)를 복사해 `service/.env`를 만듭니다.

- **DB**: `DB_DRIVER`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` — 로컬 Docker 사용 시 포트는 **`55432`** 로 맞추는 경우가 많습니다.
- **Redis**: `REDIS_URL` (예: `redis://localhost:6379`)
- **OIDC**: `OIDC_ISSUER`, `OIDC_ADAPTER_DRIVER`, `OIDC_COOKIE_KEYS`, `OIDC_ACCESS_TOKEN_FORMAT` 등
- **암호화**: `JWKS_ENCRYPTION_KEY`, `OTP_TOKEN_SECRET` (hex, 길이는 예시 파일 참고)
- **초기 관리자 시드(마이그레이션)**: `ADMIN_USERNAME`, `ADMIN_PASSWORD` — 시드 마이그레이션([`Migration20260404000001`](service/src/infrastructure/mikro-orm/migrations/postgresql/Migration20260404000001.ts) 등)에 **필수**입니다.
- **선택**: `ADMIN_UI_URL`, Google 시드용 `SEED_GOOGLE_OIDC_CLIENT_ID` / `SEED_GOOGLE_OIDC_CLIENT_SECRET` 등

관리 콘솔(`ui`)은 [`ui/.env.development`](ui/.env.development) 등에서 `VITE_API_BASE_URL`(예: 프록시 사용 시 `/api`)을 확인합니다.

### 4. DB 마이그레이션

```bash
yarn workspace @auth/service mikro-orm migration:up
```

### 5. Interaction UI 빌드

로그인·동의 화면을 쓰려면 빌드 산출물이 필요합니다.

```bash
yarn interaction-ui:build
```

### 6. 개발 서버 실행

```bash
# 백엔드 + 관리 UI 동시 (백그라운드 프로세스 2개)
yarn dev

# 개별 실행
yarn service:dev    # API·OIDC — http://localhost:3000
yarn ui:dev         # 관리 콘솔 — http://localhost:5173 (기본)
```

Interaction 화면을 수정한 뒤에는 다시 `yarn interaction-ui:build` 하고 Nest를 재시작하는 것이 안전합니다.

---

## OIDC·Interaction URL

| 용도 | 메서드 | 경로 |
|------|--------|------|
| Discovery | GET | `/t/:tenantCode/oidc/.well-known/openid-configuration` |
| Authorize | GET | `/t/:tenantCode/oidc/auth` |
| Token | POST | `/t/:tenantCode/oidc/token` |
| Userinfo | GET | `/t/:tenantCode/oidc/userinfo` |
| Revoke | POST | `/t/:tenantCode/oidc/revoke` |
| Session end | GET | `/t/:tenantCode/oidc/session/end` |
| Interaction SPA | GET | `/t/:tenantCode/interaction/:uid` |
| 외부 IdP 시작 | GET | `/t/:tenantCode/interaction/:uid/idp/:provider` |
| 외부 IdP 콜백 | GET | `/t/:tenantCode/interaction/:uid/idp/:provider/callback` |

Authorize는 **PKCE(`code_challenge` / `code_challenge_method=S256`)가 필요**합니다.  
브라우저로 interaction UI를 보려면 authorize URL로 진입해 리다이렉트된 `/interaction/:uid`를 사용합니다.

---

## 관리 API 개요

관리자 브라우저 세션은 `POST /admin/session`(바디: `username`, `password`)으로 발급한 Bearer 토큰을 사용합니다.  
테넌트별 리소스는 경로에 테넌트 코드가 들어갑니다.

| 범위 | 예시 |
|------|------|
| 플랫폼(마스터) 테넌트 | `GET/POST /admin/tenants` |
| 테넌트 스코프 | `GET/POST /t/:tenantCode/admin/clients`, `.../users`, `.../roles`, `.../groups`, `.../permissions`, `.../policies`, `.../keys`, `.../audit-logs`, `.../identity-providers` 등 |

전체 목록은 Swagger 또는 `service/src/presentation/controllers/admin` 을 참고하면 됩니다.

---

## 테스트

```bash
# 단위·통합(Jest)
yarn service:test

yarn workspace @auth/service test --testPathPattern="client-mapper.spec.ts" --no-coverage

# E2E (별도 DB 권장)
yarn service:test:e2e:infra:up
yarn service:test:e2e
yarn service:test:e2e:infra:down
```

---

## 문서

| 문서 | 경로 |
|------|------|
| OIDC 아키텍처 | [`service/docs/OIDC.md`](service/docs/OIDC.md) |
| Interaction UI 커스터마이징 | [`service/docs/INTERACTION_UI.md`](service/docs/INTERACTION_UI.md) |
| 데이터베이스 | [`service/DATABASE.md`](service/DATABASE.md) |
