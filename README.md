# Auth Platform

멀티테넌트 인증 플랫폼으로, **OAuth 2.0 / OpenID Connect(OIDC) 서버**와 **관리 UI**로 구성됩니다.  
`node-oidc-provider`를 프로토콜 엔진으로 사용하며, 테넌트 단위 격리, 클라이언트 정책 관리, 사용자 인증을 제공합니다.

---

## 프로젝트 구조

```
auth/
├── service/          # NestJS 백엔드 (OIDC 서버 + 관리 API)
├── ui/               # React 관리자 콘솔 (Vite + Ant Design)
├── docker-compose.yml
└── package.json      # Yarn Workspaces 루트
```

### `service` — 백엔드

클린 아키텍처(레이어드)로 구성되어 있습니다.

```
service/src/
├── domain/           # 도메인 모델, 레포지토리 인터페이스, 도메인 이벤트
├── application/      # 커맨드/쿼리 핸들러, DTO, 포트(인터페이스)
├── infrastructure/   # DB(MikroORM), Redis, OIDC Provider, 암호화 어댑터
└── presentation/     # REST 컨트롤러, HTTP 미들웨어, 뷰 레이어
```

### `ui` — 관리자 콘솔

테넌트·클라이언트·사용자·권한·역할·그룹을 관리하는 SPA입니다.

---

## 주요 기능

| 영역 | 설명 |
|------|------|
| **멀티테넌시** | 테넌트별 독립 OIDC issuer(`/t/:tenantCode/oidc`) |
| **OIDC/OAuth2** | Authorization Code + PKCE, Token, Userinfo, Revoke, Session End |
| **클라이언트 관리** | confidential·public·service 타입, 리소스 인디케이터, 동의 생략(`skipConsent`) |
| **클라이언트 인증 정책** | AuthMethod, MFA, 세션 유지 시간, 동의 요구 등 정책 분리 |
| **사용자/권한** | 사용자, 역할, 권한, 그룹, 역할 상속 |
| **Interaction** | 커스텀 로그인·동의 화면(`/t/:tenantCode/interaction/:uid`) |
| **스토리지** | PostgreSQL / MySQL / MSSQL + Redis (rdb · redis · hybrid 드라이버 선택) |
| **암호화** | Argon2id / PBKDF2 비밀번호 해시, 대칭 암호화, JWKS 키 관리 |

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 런타임 | Node.js 22 |
| 백엔드 프레임워크 | NestJS 11 |
| ORM | MikroORM 6 |
| OIDC 엔진 | node-oidc-provider 9 |
| 데이터베이스 | PostgreSQL 16 (MySQL / MSSQL 지원) |
| 캐시 | Redis 7 |
| 프론트엔드 | React 18 + Vite + Ant Design |
| 패키지 관리 | Yarn Berry (Workspaces + PnP) |

---

## 빠른 시작

### 1. 인프라 실행

```bash
docker-compose up -d
```

PostgreSQL(`:55432`)과 Redis(`:6379`)가 실행됩니다.

### 2. 의존성 설치

```bash
yarn install
```

### 3. 환경변수 설정

`service/` 디렉토리에 `.env` 파일을 생성합니다.

```env
# DB
DB_DRIVER=postgresql
DB_HOST=localhost
DB_PORT=55432
DB_NAME=auth
DB_USER=postgres
DB_PASSWORD=secret

# OIDC
OIDC_ISSUER=http://localhost:3000
OIDC_ADAPTER_DRIVER=hybrid
OIDC_ACCESS_TOKEN_FORMAT=opaque
OIDC_COOKIE_KEYS=dev1,dev2
OIDC_CACHE_TTL_MARGIN_SEC=5
OIDC_CACHE_NEGATIVE_TTL_SEC=3
OIDC_CACHE_BACKFILL_TTL_SEC=60

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 4. DB 마이그레이션

```bash
yarn workspace @auth/service mikro-orm migration:up
```

### 5. 개발 서버 실행

```bash
# service + ui 동시 실행
yarn dev

# 개별 실행
yarn service:dev   # http://localhost:3000
yarn ui:dev        # http://localhost:5173
```

---

## OIDC 엔드포인트

테넌트별로 독립된 issuer를 사용합니다.

```
# Discovery
GET /t/:tenantCode/oidc/.well-known/openid-configuration

# 주요 엔드포인트
GET  /t/:tenantCode/oidc/auth
POST /t/:tenantCode/oidc/token
GET  /t/:tenantCode/oidc/userinfo
POST /t/:tenantCode/oidc/revoke
GET  /t/:tenantCode/oidc/session/end

# Interaction (로그인·동의 화면)
GET  /t/:tenantCode/interaction/:uid
```

---

## 관리 API

인증된 관리자가 사용하는 REST API입니다.

```
POST   /admin/tenants
GET    /admin/tenants

POST   /admin/tenants/:tenantId/clients
GET    /admin/tenants/:tenantId/clients
PATCH  /admin/tenants/:tenantId/clients/:id

POST   /admin/tenants/:tenantId/users
GET    /admin/tenants/:tenantId/users

POST   /admin/tenants/:tenantId/roles
POST   /admin/tenants/:tenantId/groups
POST   /admin/tenants/:tenantId/permissions
```

---

## 테스트

```bash
# 전체 단위 테스트
yarn service:test

# 특정 파일
yarn workspace @auth/service test --testPathPattern="client-mapper.spec.ts" --no-coverage
```

---

## 문서

| 문서 | 경로 |
|------|------|
| OIDC 아키텍처 상세 | [`service/docs/OIDC.md`](service/docs/OIDC.md) |
| 데이터베이스 스키마 | [`service/DATABASE.md`](service/DATABASE.md) |
