# 데이터베이스 설정

이 서비스는 **PostgreSQL**, **MySQL**, **MSSQL** 세 가지 데이터베이스를 지원합니다.
`DB_DRIVER` 환경변수를 통해 시작 시 드라이버를 선택할 수 있습니다.

---

## 환경변수

| 변수명        | 설명                     | 기본값       |
|---------------|--------------------------|--------------:|
| `DB_DRIVER`   | 데이터베이스 드라이버     | `postgresql` |
| `DB_HOST`     | 데이터베이스 호스트       | `localhost`  |
| `DB_PORT`     | 데이터베이스 포트         | (드라이버별) |
| `DB_NAME`     | 데이터베이스 이름         | `auth`       |
| `DB_USER`     | 데이터베이스 사용자       | `postgres`   |
| `DB_PASSWORD` | 데이터베이스 비밀번호     | (빈 문자열)  |

### 지원하는 `DB_DRIVER` 값

| 값           | 드라이버 패키지          | 기본 포트    |
|--------------|------------------------|--------------|
| `postgresql` | `@mikro-orm/postgresql`| `5432`       |
| `mysql`      | `@mikro-orm/mysql`     | `3306`       |
| `mssql`      | `@mikro-orm/mssql`     | `1433`       |

`DB_PORT`를 설정하지 않으면 선택된 드라이버의 기본 포트가 자동으로 사용됩니다.

---

## 빠른 시작

### PostgreSQL

```bash
DB_DRIVER=postgresql \
DB_HOST=localhost \
DB_PORT=5432 \
DB_NAME=auth \
DB_USER=postgres \
DB_PASSWORD=secret \
yarn workspace @auth/service start:dev
```

### MySQL

```bash
DB_DRIVER=mysql \
DB_HOST=localhost \
DB_PORT=3306 \
DB_NAME=auth \
DB_USER=root \
DB_PASSWORD=secret \
yarn workspace @auth/service start:dev
```

### MSSQL

```bash
DB_DRIVER=mssql \
DB_HOST=localhost \
DB_PORT=1433 \
DB_NAME=auth \
DB_USER=sa \
DB_PASSWORD=secret \
yarn workspace @auth/service start:dev
```

---

## 마이그레이션

데이터베이스별로 DDL 문법이 다르기 때문에 마이그레이션은 드라이버별로 분리되어 있습니다:

```
service/src/infrastructure/mikro-orm/migrations/
  postgresql/
  mysql/
  mssql/
```

`DB_DRIVER` 값에 따라 자동으로 해당 디렉토리를 참조합니다.

### 마이그레이션 생성

```bash
DB_DRIVER=postgresql yarn workspace @auth/service mikro-orm migration:create
```

### 마이그레이션 실행

```bash
DB_DRIVER=postgresql yarn workspace @auth/service mikro-orm migration:up
```

`postgresql` 부분을 `mysql` 또는 `mssql`로 변경하여 사용하면 됩니다.

---

## 엔티티 호환성

모든 엔티티는 MikroORM 추상 타입을 사용하여 데이터베이스 간 호환성을 보장합니다:

| 추상 타입     | PostgreSQL    | MySQL          | MSSQL            |
|---------------|---------------|----------------|------------------|
| `datetime`    | `timestamptz` | `datetime`     | `datetime2`      |
| `json`        | `jsonb`       | `json`         | `nvarchar(max)`  |
| `blob`        | `bytea`       | `blob`         | `varbinary(max)` |
| `boolean`     | `boolean`     | `tinyint(1)`   | `bit`            |
| `bigint`      | `bigint`      | `bigint`       | `bigint`         |
| `varchar`     | `varchar(n)`  | `varchar(n)`   | `nvarchar(n)`    |
| `text`        | `text`        | `text`         | `nvarchar(max)`  |

---

## 아키텍처 참고

- MikroORM 설정 파일: `service/src/infrastructure/mikro-orm/config/mikro-orm.config.ts`
- 엔티티 파일 위치: `service/src/infrastructure/mikro-orm/entities/`
- 모든 인프라 어댑터는 `@mikro-orm/core`에서 `EntityManager`를 가져옵니다 (드라이버 비종속)
- MikroORM은 `AppModule`에서 `MikroOrmModule.forRoot()`로 등록됩니다

### BaseEntity

`BaseEntity`를 상속하는 엔티티는 자동으로 다음 컬럼을 갖습니다:

| 컬럼 | 타입 | 설명 |
|------|------|------|
| created_at | datetime | 생성 시점 (자동) |
| updated_at | datetime | 수정 시점 (자동) |

---

## ER 다이어그램 (핵심 관계)

```
tenant ─┬── tenant_config (1:1)
        ├── tenant_client ──── client ── client_auth_policy
        ├── user ────── user_credential
        │    ├── user_group ── group ── group_role
        │    ├── user_role
        │    └── user_identity
        ├── role ────── role_permission ── permission
        │    └── role_inherit
        ├── identity_provider
        └── otp_token (denormalized)

oidc_model    (oidc-provider 내부 모델 저장소)
jwks_key      (JWKS 키 관리)
consent       (사용자 동의 기록)
event         (감사 로그)
```

---

## 스키마

### 테넌트 관련

#### `tenant`

멀티테넌트의 최상위 엔티티. 모든 주요 엔티티는 tenant에 종속된다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | bigint (PK, auto) | |
| code | varchar(64) | 테넌트 고유 코드 |
| name | varchar(128) | 테넌트 이름 |
| created_at | datetime | |
| updated_at | datetime | |

- UK: `uk_tenant_code` (code)

#### `tenant_config`

테넌트별 설정. tenant와 1:1 관계.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| tenant_id | bigint (PK, FK) | tenant.id (CASCADE) |
| signup_policy | varchar(10) | `invite` \| `open` (기본: open) |
| require_phone_verify | boolean | 전화번호 인증 필수 여부 (기본: false) |
| brand_name | varchar(128) | 브랜드명 (nullable) |
| extra | json | 추가 설정 (nullable) |

#### `tenant_client`

테넌트-클라이언트 연결 (다대다).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | bigint (PK, auto) | |
| tenant_id | bigint (FK) | tenant.id (CASCADE) |
| client_id | bigint (FK) | client.id (CASCADE) |
| enabled | boolean | 활성화 여부 (기본: true) |
| created_at | datetime | |
| updated_at | datetime | |

- UK: `uk_tc` (tenant_id, client_id)

---

### 클라이언트 (OIDC)

#### `client`

OIDC 클라이언트 등록 정보.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | bigint (PK, auto) | |
| tenant_id | bigint (FK) | tenant.id (RESTRICT) |
| client_id | varchar(128) | OIDC client_id |
| secret_enc | varchar(512) | 암호화된 클라이언트 시크릿 (nullable) |
| name | varchar(128) | 클라이언트 이름 |
| type | varchar(20) | `confidential` \| `public` \| `service` (기본: public) |
| enabled | boolean | 활성화 여부 (기본: true) |
| redirect_uris | json | 허용 리다이렉트 URI 목록 (기본: []) |
| grant_types | json | 허용 grant type 목록 (기본: ["authorization_code"]) |
| response_types | json | 허용 response type 목록 (기본: ["code"]) |
| token_endpoint_auth_method | varchar(40) | 토큰 엔드포인트 인증 방식 (기본: none) |
| scope | varchar(512) | 허용 스코프 (기본: openid) |
| post_logout_redirect_uris | json | 로그아웃 후 리다이렉트 URI 목록 (기본: []) |
| application_type | varchar(10) | `web` \| `native` (기본: web) |
| backchannel_logout_uri | varchar(512) | Back-channel 로그아웃 URI (nullable) |
| frontchannel_logout_uri | varchar(512) | Front-channel 로그아웃 URI (nullable) |
| allowed_resources | json | 허용 리소스 서버 origin 목록 (기본: []) |
| skip_consent | boolean | 동의 화면 건너뜀 여부 — 1st-party 클라이언트용 (기본: false) |
| created_at | datetime | |
| updated_at | datetime | |

- UK: `uk_client_tenant_clientid` (tenant_id, client_id)

> **`skip_consent`**: `true`이면 OIDC 인터랙션 시 동의 화면 없이 Grant를 자동 생성합니다 (`loadExistingGrant` 콜백).

#### `client_auth_policy`

클라이언트별 인증 정책. 허용 인증 수단, MFA, 세션 등을 정의한다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | bigint (PK, auto) | |
| tenant_id | bigint (FK) | tenant.id (RESTRICT) |
| client_id | bigint (FK) | client.id (CASCADE) |
| allowed_auth_methods | json | 허용 인증 방식 (기본: ["password"]) |
| default_acr | varchar(128) | 기본 ACR 값 (기본: urn:auth:pwd) |
| mfa_required | boolean | MFA 필수 여부 (기본: false) |
| allowed_mfa_methods | json | 허용 MFA 방식 (기본: ["totp"]) |
| max_session_duration_sec | int | 최대 세션 유지 시간(초) (nullable) |
| consent_required | boolean | 동의 화면 필수 여부 (기본: true) |
| require_auth_time | boolean | auth_time 클레임 필수 여부 (기본: false) |
| created_at | datetime | |
| updated_at | datetime | |

- UK: `uk_client_auth_policy_client` (client_id)

---

### 사용자

#### `user`

사용자 계정. PK는 ULID (char(26)).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | char(26) (PK) | ULID |
| tenant_id | bigint (FK) | tenant.id (RESTRICT) |
| username | varchar(128) | 사용자명 |
| email | varchar(191) | 이메일 (nullable) |
| email_verified | boolean | 이메일 인증 여부 (기본: false) |
| phone | varchar(32) | 전화번호 (nullable) |
| phone_verified | boolean | 전화번호 인증 여부 (기본: false) |
| status | varchar(20) | `ACTIVE` \| `LOCKED` \| `DISABLED` \| `WITHDRAWN` (기본: ACTIVE) |
| created_at | datetime | |
| updated_at | datetime | |

- UK: `uk_user_tenant_username` (tenant_id, username)
- UK: `uk_user_tenant_email` (tenant_id, email)

#### `user_credential`

사용자 자격증명. 비밀번호, TOTP, WebAuthn 등을 분리 저장한다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | bigint (PK, auto) | |
| user_id | char(26) (FK) | user.id (CASCADE) |
| type | varchar(20) | `password` \| `totp` \| `webauthn` \| `recovery_code` |
| secret_hash | varchar(255) | 해시된 자격증명 |
| hash_alg | varchar(64) | 해시 알고리즘 (예: argon2id, pbkdf2) (nullable) |
| hash_params | json | 해시 파라미터 (nullable) |
| hash_version | int | 해시 버전 (nullable) |
| enabled | boolean | 활성화 여부 (기본: true) |
| expires_at | datetime | 만료 시점 (nullable) |
| created_at | datetime | |
| updated_at | datetime | |

- IDX: `idx_ucred_user_type` (user_id, type)

#### `user_identity`

외부 IdP 연동 (소셜 로그인).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | bigint (PK, auto) | |
| tenant_id | bigint (FK) | tenant.id (RESTRICT) |
| user_id | char(26) (FK) | user.id (CASCADE) |
| provider | varchar(20) | `kakao` \| `naver` \| `google` \| `apple` |
| provider_sub | varchar(191) | 외부 IdP의 사용자 식별자 |
| email | varchar(191) | IdP에서 제공한 이메일 (nullable) |
| profile_json | json | IdP 프로필 원본 (nullable) |
| linked_at | datetime | 연동 시점 |
| created_at | datetime | |
| updated_at | datetime | |

- UK: `uk_user_identity` (tenant_id, provider, provider_sub)

#### `identity_provider`

테넌트별 외부 IdP 설정.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | bigint (PK, auto) | |
| tenant_id | bigint (FK) | tenant.id (RESTRICT) |
| provider | varchar(20) | `kakao` \| `naver` \| `google` \| `apple` |
| client_id | varchar(191) | IdP에 등록된 client_id |
| client_secret | varchar(255) | IdP client_secret (nullable) |
| redirect_uri | varchar(255) | IdP 콜백 URI |
| enabled | boolean | 활성화 여부 (기본: true) |
| created_at | datetime | |
| updated_at | datetime | |

- UK: `uk_idp` (tenant_id, provider)

#### `otp_token`

일회용 토큰 (이메일/SMS 인증). PK는 ULID. 비정규화(tenant_id, user_id를 varchar로 저장)하여 쓰기 성능을 최적화한다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | char(26) (PK) | ULID |
| tenant_id | varchar(64) | 테넌트 ID (비정규화) |
| user_id | char(26) | 사용자 ID (비정규화) |
| purpose | varchar(32) | 토큰 목적 (예: email_verify, password_reset) |
| request_id | char(26) | 요청 단위 식별자 |
| token_hash | varchar(128) | 해시된 토큰 |
| issued_at | datetime | 발급 시점 |
| expires_at | datetime | 만료 시점 |
| consumed_at | datetime | 소비 시점 (nullable) |
| created_at | datetime | |

- UK: `uk_otp_token_request_id` (request_id)
- IDX: `idx_otp_tenant_user_purpose` (tenant_id, user_id, purpose)
- IDX: `idx_otp_expires_at` (expires_at)

---

### RBAC (역할 기반 접근 제어)

#### `role`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | bigint (PK, auto) | |
| tenant_id | bigint (FK) | tenant.id (RESTRICT) |
| code | varchar(128) | 역할 코드 |
| name | varchar(128) | 역할 이름 |
| description | varchar(255) | 설명 (nullable) |
| created_at | datetime | |
| updated_at | datetime | |

- UK: `uk_role_tenant_code` (tenant_id, code)

#### `permission`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | bigint (PK, auto) | |
| tenant_id | bigint (FK) | tenant.id (RESTRICT) |
| code | varchar(128) | 퍼미션 코드 (예: `post:read`) |
| resource | varchar(128) | 리소스 (nullable, 예: `post`) |
| action | varchar(64) | 액션 (nullable, 예: `read`) |
| description | varchar(255) | 설명 (nullable) |
| created_at | datetime | |
| updated_at | datetime | |

- UK: `uk_perm_tenant_code` (tenant_id, code)

#### `group`

계층형 그룹. 자기참조 `parent_id`로 트리 구조를 표현한다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | bigint (PK, auto) | |
| tenant_id | bigint (FK) | tenant.id (RESTRICT) |
| code | varchar(128) | 그룹 코드 |
| name | varchar(128) | 그룹 이름 |
| parent_id | bigint (FK, self) | 상위 그룹 (nullable, SET NULL) |
| created_at | datetime | |
| updated_at | datetime | |

- UK: `uk_grp_tenant_code` (tenant_id, code)

#### 조인 테이블

| 테이블 | PK | FK 컬럼 | 설명 |
|--------|-----|---------|------|
| `user_role` | (user_id, role_id) | user, role, client(nullable) | 사용자-역할 매핑. client 지정 시 해당 클라이언트 범위 |
| `user_group` | (user_id, group_id) | user, group | 사용자-그룹 매핑 |
| `group_role` | (grp_id, role_id) | group, role, client(nullable) | 그룹-역할 매핑 |
| `role_permission` | (role_id, permission_id) | role, permission | 역할-퍼미션 매핑 |
| `role_inherit` | (parent_role_id, child_role_id) | parent role, child role | 역할 상속. CHECK: parent <> child |

- `user_role` UK: `uk_user_role_user_role_client` (user_id, role_id, client_id)
- `group_role` UK: `uk_group_role_group_role_client` (grp_id, role_id, client_id)

---

### OIDC Provider 내부 저장소

#### `oidc_model`

node-oidc-provider의 Adapter가 사용하는 범용 모델 저장소. Session, AccessToken, AuthorizationCode, RefreshToken, Grant, Interaction 등 모든 provider 내부 모델을 `kind`로 구분하여 저장한다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | varchar(128) (PK) | 모델 ID |
| kind | varchar(64) | 모델 종류 (Session, AccessToken 등) |
| payload | json | 모델 데이터 |
| uid | varchar(128) | Session UID (nullable) |
| grant_id | varchar(128) | Grant ID (nullable) |
| user_code | varchar(128) | Device Code 사용자 코드 (nullable) |
| consumed_at | datetime | 소비 시점 (nullable) |
| expires_at | datetime | 만료 시점 (nullable) |
| created_at | datetime | |

- IDX: `idx_oidc_model_kind_uid` (kind, uid)
- IDX: `idx_oidc_model_kind_grant` (kind, grant_id)
- IDX: `idx_oidc_model_kind_usercode` (kind, user_code)

---

### 키 관리

#### `jwks_key`

JWKS 서명 키 관리. 키 로테이션 시 이전 키를 `rotated` 상태로 유지하여 오버랩 윈도우를 보장한다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| kid | varchar(64) (PK) | Key ID |
| tenant_id | bigint (FK) | tenant.id (RESTRICT) |
| algorithm | varchar(16) | 알고리즘 (RS256, ES256 등) |
| public_key | text | 공개키 (PEM/JWK) |
| private_key_enc | text | 암호화된 비공개키 |
| status | varchar(16) | `active` \| `rotated` \| `revoked` (기본: active) |
| rotated_at | datetime | 로테이션 시점 (nullable) |
| expires_at | datetime | 만료 시점 (nullable) |
| created_at | datetime | |

- IDX: `idx_jwks_tenant_status` (tenant_id, status)

---

### 동의 관리

#### `consent`

사용자가 클라이언트에 부여한 스코프 동의 기록.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | bigint (PK, auto) | |
| tenant_id | bigint (FK) | tenant.id (CASCADE) |
| user_id | char(26) (FK) | user.id (CASCADE) |
| client_id | bigint (FK) | client.id (CASCADE) |
| granted_scopes | varchar(512) | 허용된 스코프 목록 |
| granted_at | datetime | 동의 시점 |
| revoked_at | datetime | 철회 시점 (nullable) |

- UK: `uk_consent_tenant_user_client` (tenant_id, user_id, client_id)

---

### 감사 로그

#### `event`

보안 및 운영 감사 로그. 불변(append-only)으로 운용한다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | bigint (PK, auto) | |
| tenant_id | bigint (FK) | tenant.id (CASCADE) |
| user_id | char(26) (FK) | user.id (nullable, SET NULL) |
| client_id | bigint (FK) | client.id (nullable, SET NULL) |
| category | varchar(20) | AUTH, USER, ROLE, GROUP, PERMISSION, SECURITY, SYSTEM, OTHER |
| severity | varchar(20) | INFO, WARN, ERROR |
| action | varchar(20) | LOGIN, LOGOUT, TOKEN_ISSUED, ACCESS_DENIED 등 |
| resource_type | varchar(64) | 대상 리소스 종류 (nullable) |
| resource_id | varchar(191) | 대상 리소스 ID (nullable) |
| success | boolean | 성공 여부 (기본: true) |
| reason | varchar(255) | 사유 (nullable) |
| ip | blob | IP 주소 바이너리 (nullable) |
| user_agent | varchar(255) | User-Agent (nullable) |
| metadata | json | 추가 메타데이터 (nullable) |
| occurred_at | datetime | 발생 시점 |

- IDX: `idx_event_tenant_time` (tenant_id, occurred_at)
- IDX: `idx_event_category_time` (category, occurred_at)
- IDX: `idx_event_user_time` (user_id, occurred_at)
- IDX: `idx_event_client_time` (client_id, occurred_at)
- IDX: `idx_event_action_time` (action, occurred_at)
