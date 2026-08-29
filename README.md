# Auth Platform

Multi-tenant 인증 플랫폼으로, **OAuth 2.0 / OpenID Connect(OIDC) 서버**와 **관리 UI**, **로그인·동의용 interaction SPA**로 구성됩니다.
`node-oidc-provider`를 프로토콜 엔진으로 사용하며, Tenant 단위 격리, Client 정책, 외부 IdP(OAuth2) 연동, MFA 등을 제공합니다.

---

## 프로젝트 구조

```
auth/
├── service/                 # NestJS 백엔드 (OIDC + 관리 API + interaction 정적 서빙)
│   └── interaction-ui/      # 로그인·동의·MFA 화면 (Vite + React, 빌드 산출물을 Nest가 서빙)
├── ui/                      # React 관리자 콘솔 (Vite + Ant Design)
├── docs/                    # AuthDocs (Docusaurus + Markdown 원본)
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

Tenant·Client·사용자·권한·역할·그룹·정책·**Identity Provider** 등을 관리하는 SPA입니다. API는 Tenant context가 필요한 경로가 `/t/:tenantCode/admin/...` 형태입니다.

### `service/interaction-ui` — OIDC Interaction 화면

OIDC authorize 흐름 중 **로그인·동의·MFA**를 담당하는 별도 Vite 앱입니다.  
`yarn interaction-ui:build`로 `service/interaction-ui/dist`를 만든 뒤 Nest가 `index.html`과 `/interaction-assets/*` 정적 파일을 제공합니다.

---

## 주요 기능

| 영역                 | 설명                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Multi-tenancy**    | Tenant별 독립 OIDC issuer (`/t/:tenantCode/oidc`)                                                                      |
| **OIDC/OAuth2**      | Authorization Code + **PKCE(필수)**, Token, Userinfo, Revoke, Session End                                              |
| **Client 관리**      | confidential·public·service 타입, resource indicator, 동의 생략(`skipConsent`)                                         |
| **Client 인증 정책** | 허용 로그인 방식, MFA, 세션·동의 정책 등                                                                               |
| **사용자/권한**      | 사용자, 역할, 권한, 그룹                                                                                               |
| **Interaction**      | `/t/:tenantCode/interaction/:uid` — 비밀번호 로그인, **외부 IdP 버튼**, 동의, MFA                                      |
| **외부 IdP**         | Tenant별 OAuth2 연동 — 내장 키(`google`, `kakao`, `naver`, `apple`) 또는 **임의 slug + `oauth_config` JSON**           |
| **관리자 세션**      | `POST /admin/session` — `master` Tenant의 `SUPER_ADMIN` 로그인 후 `admin_session` + `admin_refresh` HttpOnly 쿠키 발급 |
| **스토리지**         | PostgreSQL / MySQL / MSSQL + Redis (`rdb` · `redis` · `hybrid` 어댑터)                                                 |
| **암호화**           | Argon2id·PBKDF2 비밀번호 해시, 대칭 암호화, JWKS 키 관리                                                               |

---

## 기술 스택

| 구분           | 기술                               |
| -------------- | ---------------------------------- |
| 런타임         | Node.js 24+                        |
| 백엔드         | NestJS 11                          |
| ORM            | MikroORM 6                         |
| OIDC           | node-oidc-provider 9               |
| 데이터베이스   | PostgreSQL 16 (MySQL / MSSQL 지원) |
| 캐시           | Redis 7                            |
| 관리 UI        | React 19, Vite, Ant Design         |
| Interaction UI | React 19, Vite                     |
| 패키지 관리    | Yarn Berry (Workspaces + PnP)      |

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
- **초기 관리자**: `ADMIN_USERNAME`, `ADMIN_PASSWORD` — 새 DB에서 보존된 마이그레이션([`Migration20260404000001`](service/src/infrastructure/mikro-orm/migrations/postgresql/Migration20260404000001.ts) 등)을 실행할 때 **필수**입니다. `bootstrap:admin:prod`는 관리자가 없을 때만 두 값을 사용합니다.
- **관리 UI**: `ADMIN_UI_URL` — 운영(`NODE_ENV=production`)의 관리자 bootstrap에서는 필수입니다. 절대 `http(s)` URL이어야 하고, 원격 호스트는 HTTPS만 허용합니다. HTTP는 `localhost`, `127.0.0.1`, `[::1]`에서만 허용합니다.
- **선택**: Google 시드용 `SEED_GOOGLE_OIDC_CLIENT_ID` / `SEED_GOOGLE_OIDC_CLIENT_SECRET` 등

관리 콘솔(`ui`)은 [`ui/.env.development`](ui/.env.development) 등에서 `VITE_API_BASE_URL`(예: 프록시 사용 시 `/api`)을 확인합니다.

### 4. DB 마이그레이션

로컬 개발에서만 Yarn 4와 MikroORM CLI를 사용합니다.

```bash
corepack yarn workspace @auth/service migration:up
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

## 운영 마이그레이션과 bootstrap

운영 빌드 산출물은 TypeScript, `ts-node`, MikroORM CLI 없이 컴파일된 JavaScript를 Node.js로 직접 실행합니다. MikroORM의 컴파일된 migration 경로는 `service/`를 현재 작업 디렉터리로 삼는 `./dist`를 기준으로 합니다. 저장소 루트에서 실행할 때의 순서는 다음과 같습니다.

```bash
cd service
node --env-file=.env dist/cli/migrate.js
node --env-file=.env dist/cli/bootstrap-admin.js
node --env-file=.env dist/cli/bootstrap-acme.js
node --env-file=.env dist/main.js
```

마이그레이션을 제외한 bootstrap은 모두 선택적인 **명시적 운영자 작업**이며, 각 서비스 replica가 시작할 때 자동 실행하지 않습니다.

- `bootstrap:admin:prod`는 없는 관리자 리소스만 생성합니다. 관리자가 없을 때는 `ADMIN_USERNAME`과 `ADMIN_PASSWORD`가 필요합니다. 기존 사용자는 `ACTIVE` 상태이며 활성화된 password credential이 있을 때만 호환되는 관리자로 인정하고, 그렇지 않으면 기존 credential을 생성·교체하거나 역할을 부여하지 않고 안전한 conflict로 실패합니다.
- `bootstrap:acme:prod`는 `acme` tenant가 없을 때 tenant command로 생성하며, 이 경로에서 canonical 내장 scope가 함께 생성됩니다. 기존 `acme` tenant는 설정을 덮어쓰지 않고 그대로 두므로, 누락된 scope를 복구하거나 보장하지 않습니다. OIDC client나 application을 생성하지 않습니다.

관리 UI URL은 새 client를 만들기 전에 host case, 기본 port, path의 끝 `/`를 canonical 형태로 정규화합니다. 보존된 `Migration20260404000001`은 환경 변수 원문을 그대로 보간하므로, bootstrap은 검증을 통과한 trimmed 원문이 같은 canonical URL로 매핑되는 경우에만 그 원문으로 만들어진 redirect/logout URI를 정확히 호환 대상으로 인식합니다. 임의의 slash 변형은 허용하지 않으며 새로 생성할 때는 항상 canonical URI를 저장합니다.

Yarn을 사용할 수 있는 운영 호스트에서는 동일한 컴파일 명령을 패키지 스크립트로 실행할 수 있습니다.

```bash
corepack yarn workspace @auth/service migration:up:prod
corepack yarn workspace @auth/service bootstrap:admin:prod
corepack yarn workspace @auth/service bootstrap:acme:prod
```

위 Yarn 스크립트는 `service/.env`를 자동으로 읽지 않으므로 필요한 변수를 셸 환경에 먼저 export해야 합니다. `.env` 파일을 그대로 사용할 때는 앞의 Node.js 24 `--env-file=.env` 명령을 사용합니다.

서비스 이미지의 entrypoint는 기본 서버 명령이나 덮어쓴 bootstrap 명령보다 먼저 `node dist/cli/migrate.js`를 항상 실행하고, 실패하면 서버를 시작하지 않습니다. 따라서 이미지에서 bootstrap을 실행할 때는 마이그레이션을 별도로 반복하지 말고, Secret 등으로 환경 변수를 주입한 후 이미지 명령만 다음과 같이 덮어씁니다.

```bash
docker run --rm --env-file path/to/production.env ghcr.io/your-org/your-repo/auth-service:tag node dist/cli/bootstrap-admin.js
docker run --rm --env-file path/to/production.env ghcr.io/your-org/your-repo/auth-service:tag node dist/cli/bootstrap-acme.js
```

운영 이미지의 서버 시작, migration, bootstrap 경로는 Yarn을 사용하지 않고 Node.js로 컴파일된 JavaScript를 직접 실행합니다. 기반 이미지에는 Yarn 1과 Corepack이 있지만 운영 실행 경로에서는 사용하지 않습니다. TypeScript, `ts-node`, MikroORM CLI는 운영 이미지에 포함되지 않으며, Yarn 4는 개발과 이미지 빌드에서만 사용합니다. 빌드된 Interaction UI도 `/app/service/interaction-ui/dist`에 포함되어 Nest의 정적 파일 경로와 일치합니다.

main 브랜치와 release 워크플로는 GHCR에 `linux/amd64`, `linux/arm64`를 포함하는 하나의 multi-platform manifest를 게시합니다. 따라서 `ghcr.io/<owner>/<repository>/auth-service:<tag>` 태그를 AMD64와 ARM64 노드에서 동일하게 사용할 수 있습니다.

---

## OIDC·Interaction URL

| 용도            | 메서드 | 경로                                                     |
| --------------- | ------ | -------------------------------------------------------- |
| Discovery       | GET    | `/t/:tenantCode/oidc/.well-known/openid-configuration`   |
| Authorize       | GET    | `/t/:tenantCode/oidc/auth`                               |
| Token           | POST   | `/t/:tenantCode/oidc/token`                              |
| Userinfo        | GET    | `/t/:tenantCode/oidc/userinfo`                           |
| Revoke          | POST   | `/t/:tenantCode/oidc/revoke`                             |
| Session end     | GET    | `/t/:tenantCode/oidc/session/end`                        |
| Interaction SPA | GET    | `/t/:tenantCode/interaction/:uid`                        |
| 외부 IdP 시작   | GET    | `/t/:tenantCode/interaction/:uid/idp/:provider`          |
| 외부 IdP 콜백   | GET    | `/t/:tenantCode/interaction/:uid/idp/:provider/callback` |

Authorize는 **PKCE(`code_challenge` / `code_challenge_method=S256`)가 필요**합니다.  
브라우저로 interaction UI를 보려면 authorize URL로 진입해 리다이렉트된 `/interaction/:uid`를 사용합니다.

---

## 관리 API 개요

관리자 브라우저 세션은 **HttpOnly cookie 기반**입니다.  
`POST /admin/session` 로그인 시 access token 성격의 `admin_session` 쿠키와 refresh token 성격의 `admin_refresh` 쿠키를 함께 발급합니다.

- `GET /admin/session`: 현재 관리자 세션 조회
- `POST /admin/session/refresh`: `admin_refresh` 쿠키로 세션 재발급
- `PUT /admin/session/password`: 현재 관리자 비밀번호 변경
- `DELETE /admin/session`: 세션 쿠키 삭제

관리 UI는 관리자 API 호출이 `401`을 반환하면 `POST /admin/session/refresh`를 **한 번 자동 시도**하고, 성공 시 원래 요청을 재시도합니다. refresh도 실패하면 로그인 화면으로 이동합니다.

Tenant별 리소스는 경로에 Tenant code가 들어갑니다.

| 범위                  | 예시                                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 플랫폼(master) Tenant | `GET/POST /admin/tenants`                                                                                                                                                     |
| Tenant scope          | `GET/POST /t/:tenantCode/admin/clients`, `.../users`, `.../roles`, `.../groups`, `.../permissions`, `.../policies`, `.../keys`, `.../audit-logs`, `.../identity-providers` 등 |

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

AuthDocs의 Markdown 원본은 [`docs/docs`](docs/docs)에 있습니다. 각 워크스페이스의 `docs` 디렉토리는 앱별 개발/운영 로컬 문서만 둡니다.

| 영역                | 문서                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| AuthDocs 시작점     | [`docs/docs/intro.md`](docs/docs/intro.md)                                                     |
| 문서 맵             | [`docs/docs/document-map.md`](docs/docs/document-map.md)                                       |
| 핵심 개념           | [`docs/docs/concepts.md`](docs/docs/concepts.md)                                               |
| Tenant 개요         | [`docs/docs/concepts/tenant/overview.md`](docs/docs/concepts/tenant/overview.md)               |
| Tenant 정책         | [`docs/docs/concepts/tenant/policies.md`](docs/docs/concepts/tenant/policies.md)               |
| Client 개요         | [`docs/docs/concepts/client/overview.md`](docs/docs/concepts/client/overview.md)               |
| Client 정책         | [`docs/docs/concepts/client/policies.md`](docs/docs/concepts/client/policies.md)               |
| Grant 개요          | [`docs/docs/concepts/client/grants/overview.md`](docs/docs/concepts/client/grants/overview.md) |
| Scope 개요          | [`docs/docs/concepts/client/scopes.md`](docs/docs/concepts/client/scopes.md)                   |
| OIDC 인증 흐름      | [`docs/docs/concepts/oidc-flow.md`](docs/docs/concepts/oidc-flow.md)                           |
| 커스텀 Grant        | [`docs/docs/concepts/client/grants/custom.md`](docs/docs/concepts/client/grants/custom.md)     |
| 관리자 UI 문서      | [`docs/docs/ui/overview.md`](docs/docs/ui/overview.md)                                         |
| Interaction UI 문서 | [`docs/docs/ui/interaction-ui.md`](docs/docs/ui/interaction-ui.md)                             |
| Redoc API 문서      | [`docs/docs/api/redoc.md`](docs/docs/api/redoc.md)                                             |

로컬 개발 문서:

| 영역              | 문서                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| Service           | [`service/docs/README.md`](service/docs/README.md)                                             |
| Service OIDC 구현 | [`service/docs/OIDC.md`](service/docs/OIDC.md)                                                 |
| Database          | [`service/docs/DATABASE.md`](service/docs/DATABASE.md)                                         |
| Admin UI          | [`ui/docs/README.md`](ui/docs/README.md)                                                       |
| Interaction UI    | [`service/interaction-ui/docs/CUSTOMIZATION.md`](service/interaction-ui/docs/CUSTOMIZATION.md) |
