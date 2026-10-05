---
title: Kubernetes 운영 계약
description: mTLS Redis, 최소 ACL, HPA migration 분리와 동일 origin UI 라우팅 계약
---

# Kubernetes 운영 계약

이 문서는 Auth 애플리케이션 이미지와 GitOps/클러스터 사이의 계약만 정의한다. 클러스터, Cloudflare, Redis ACL 자체의 변경은 인프라 저장소에서 별도로 적용한다.

## Redis 연결 계약

로컬 개발은 기존 `REDIS_URL=redis://localhost:6379` 단독 설정을 계속 지원한다. 운영 공유 Redis는 `REDIS_URL`을 설정하지 않고 다음 분리 설정을 사용한다.

| 변수                | 필수 | 설명                                                        |
| ------------------- | ---- | ----------------------------------------------------------- |
| `REDIS_HOST`        | 예   | Redis 인증서 SAN과 일치하는 DNS host                        |
| `REDIS_PORT`        | 예   | 1–65535                                                     |
| `REDIS_USERNAME`    | 예   | Auth 전용 Redis ACL 사용자                                  |
| `REDIS_PASSWORD`    | 예   | Secret으로만 주입                                           |
| `REDIS_DB`          | 예   | 공유 환경 권장값 `0`; 다른 값이면 ACL에 `SELECT` 필요       |
| `REDIS_KEY_PREFIX`  | 예   | Auth 전용 prefix. `auth`와 `auth:`는 모두 실제 `auth:`가 됨 |
| `REDIS_TLS_ENABLED` | 예   | 운영 분리 설정에서는 정확히 `true`                          |
| `REDIS_TLS_CA_CERT` | 예\* | CA PEM 원문                                                 |
| `REDIS_TLS_CERT`    | 예\* | client certificate PEM 원문                                 |
| `REDIS_TLS_KEY`     | 예\* | client private key PEM 원문                                 |

`REDIS_URL`과 `REDIS_HOST` 계열을 동시에 설정하면 시작에 실패한다. TLS는 최소 1.2, `rejectUnauthorized: true`, `servername=REDIS_HOST`로 고정된다. 인증서 검증을 끄는 설정은 제공하지 않는다. CA/certificate/key 누락, 잘못된 PEM, 잘못된 boolean/port/DB/prefix도 Redis 연결 전에 고정 오류 코드로 실패하며 원문 credential이나 key를 출력하지 않는다.

### Doppler env 주입

Doppler의 `REDIS_TLS_CA_CERT`, `REDIS_TLS_CERT`, `REDIS_TLS_KEY`에는 줄바꿈을 보존한 PEM 원문을 저장한다. Pod에는 위 표의 변수를 env로 주입한다. `REDIS_URL`은 함께 주입하지 않는다.

### Secret 파일 mount

PEM을 파일로 mount할 때는 inline 변수 대신 다음 경로 변수 중 대응하는 하나만 사용한다.

```dotenv
REDIS_TLS_CA_CERT_FILE=/var/run/secrets/auth-redis/ca.crt
REDIS_TLS_CERT_FILE=/var/run/secrets/auth-redis/tls.crt
REDIS_TLS_KEY_FILE=/var/run/secrets/auth-redis/tls.key
```

예를 들어 `REDIS_TLS_KEY`와 `REDIS_TLS_KEY_FILE`을 동시에 설정하면 시작에 실패한다. 파일을 읽을 수 없거나 비어 있어도 경로나 내용을 오류에 포함하지 않는다.

## Redis key prefix와 최소 ACL

`REDIS_KEY_PREFIX=auth`이면 ioredis가 모든 명령 key를 `auth:`로 한 번만 변환한다. 애플리케이션의 OIDC, session index, login rate limit, SAML relay/cache, identity-link 키 생성 함수에는 이 전역 prefix를 직접 넣지 않는다.

현재 코드가 요구하는 Redis 명령은 다음과 같다.

```text
PING GET SET DEL EXPIRE TTL PTTL INCR
SADD SREM SMEMBERS
MULTI EXEC
EVAL
```

- `EVAL`은 refresh token one-time consume과 reuse detection의 원자성을 보장하므로 제거하거나 우회할 수 없다.
- Lua가 내부에서 호출하는 명령은 `GET`, `SET`, `PTTL`이다. Redis 7 ACL은 이 명령들도 허용해야 한다.
- `SCRIPT LOAD`, `EVALSHA`, `INFO`, `CLIENT`는 사용하지 않는다.
- ioredis `enableReadyCheck`는 `false`로 고정되어 `INFO` 권한이 필요 없다.
- ioredis `disableClientInfo`는 `true`로 고정되어 `CLIENT SETINFO` 권한이 필요 없다.
- `REDIS_DB=0`이면 `SELECT`가 필요 없다. 0이 아닌 DB를 사용하면 `+select`를 별도로 허용해야 한다.

ACL 예시에서 password는 인프라 secret 도구가 대입해야 한다. 순서상 `-@scripting` 뒤에 `+eval`을 둬야 한다.

```text
ACL SETUSER auth-app reset on >'<secret>' ~auth:* -@all \
  +ping +get +set +del +expire +ttl +pttl +incr \
  +sadd +srem +smembers +multi +exec -@scripting +eval
```

실제 테스트는 ioredis 5.9.3의 command key metadata를 사용해 direct command, pipeline, MULTI와 EVAL의 세 `KEYS`가 모두 한 번만 prefix되는지 검증한다. EVAL의 `ARGV`와 set member 값은 key가 아니므로 변환되지 않는다. Lua에서 만드는 grant conflict key는 이미 prefix된 `KEYS[3]`에 grant ID만 연결한다.

## HPA와 migration

이미지의 기본 entrypoint는 서버 시작 전에 `node dist/cli/migrate.js`를 실행한다. 이는 단일 replica와 로컬 실행에는 편리하지만 HPA rollout에는 사용하면 안 된다. MikroORM 6.6.12 migration storage는 실행 이력 table을 제공하지만 여러 migrator 전체를 직렬화하는 전역 lock은 제공하지 않는다. 두 Pod가 동시에 같은 pending migration을 판단하면 DDL 또는 migration 이력 insert가 경합할 수 있다.

GitOps는 같은 immutable image digest로 아래 순서를 보장해야 한다.

1. migration Job을 `Complete`까지 한 번 실행한다.
2. Job 실패 시 API rollout을 중단한다.
3. API Pod는 Docker entrypoint를 우회하고 서버만 실행한다.
4. cleanup worker도 entrypoint를 우회해 정확히 1개만 실행한다.

`dist/cli/migrate.js`는 schema migration이 끝난 뒤 기존 외부 IdP client secret을
`JWKS_ENCRYPTION_KEY`로 암호화하는 멱등 backfill도 수행한다. 따라서 이 Job이 성공하기
전에 새 API Pod를 시작하거나 IdP를 생성·활성화하지 않는다. key 누락, 암호화 실패,
DB 저장 실패는 migration Job 실패로 처리하며 API rollout을 계속하지 않는다.

Kubernetes의 `command`는 Docker `ENTRYPOINT`, `args`는 `CMD`를 덮어쓴다.

```yaml
# migration Job container
command: ['node']
args: ['dist/cli/migrate.js']

# API Deployment/StatefulSet container — 모든 HPA replica
command: ['node']
args: ['dist/main.js']

# singleton cleanup worker
command: ['node']
args: ['dist/worker.js']
```

세 실행 단위의 working directory는 이미지 기본값 `/app/service`를 유지한다. migration Job과 API는 같은 image digest 및 동일한 DB 설정을 사용해야 한다. `bootstrap-admin`과 `bootstrap-acme`는 migration Job에 합치지 않고 필요한 경우 별도 명시적 Job으로 실행한다.

## `auth.rvkang.app` 동일 origin 라우팅

관리자 UI 빌드의 `VITE_API_BASE_URL`은 빈 문자열로 둔다. 그러면 cookie 기반 관리자 API를 현재 origin인 `https://auth.rvkang.app`에 호출한다. CORS에 의존하지 않으며 `ADMIN_UI_URL`과 `OIDC_ISSUER`도 다음과 같이 맞춘다.

```dotenv
VITE_API_BASE_URL=
ADMIN_UI_URL=https://auth.rvkang.app
OIDC_ISSUER=https://auth.rvkang.app
OIDC_TRUST_PROXY=true
HTTP_HSTS_ENABLED=true
HTTP_TRUST_PROXY_HOPS=<신뢰하는 ingress proxy hop 수>
```

`OIDC_TRUST_PROXY=true`와 `HTTP_TRUST_PROXY_HOPS`는 외부에서 service Pod에 직접 접근할 수 없고 ingress가 전달 헤더를 덮어쓰는 경우에만 사용한다. Cloudflare를 포함한 hop 수와 원본 client IP 전달 방식은 실제 ingress 구성을 기준으로 정하며 임의로 크게 잡지 않는다.

Ingress/HTTPRoute는 아래 공개 backend 경로를 Auth service로 먼저 매칭하고 나머지 `/`를 Auth UI nginx로 보낸다.

```text
/admin
/auth
/t
/interaction-assets
```

`/t/*`에는 tenant OIDC endpoint와 `/t/{tenant}/interaction/{uid}` HTML/API/IdP callback이 모두 포함된다. Interaction 번들은 service 이미지에 포함되며 `/interaction-assets/*`에서 제공된다. 이 두 경로를 관리자 UI SPA fallback으로 보내면 OIDC 로그인이 실패한다.

관리 UI 자체의 `/login`, `/tenants`, `/users` 같은 browser route와 `/assets/*`는 UI nginx로 보낸다. `/health`, `/ready`, `/metrics`는 service 내부 probe/수집 경로로 유지하고 공개 ingress에 노출하지 않는다. production에서 기본 비활성인 `/openapi.json`을 명시적으로 켜는 경우에도 별도 접근 제어를 둔다. Cloudflare와 ingress 모두 query string, `Set-Cookie`, `Cookie`, `Location`, `X-Forwarded-Proto=https`를 보존해야 한다.

OIDC session, grant와 replay coordination state는 Redis/RDB adapter에 저장되므로 API replica 사이의 sticky session을 요구하지 않는다. 모든 replica는 동일한 DB, Redis prefix, cookie signing key와 JWKS encryption key를 사용해야 한다.

## 외부 Interaction UI CORS 주입 계약

`externalInteractionUiUrl`이 설정된 client의 interaction API는 저장된 URL의 exact origin을
동적으로 허용한다. 반면 `/auth/identity-links/*`처럼 interaction 경로 밖에 있는 브라우저
API는 정적 `HTTP_CORS_ORIGINS` 목록을 사용한다. wildcard를 넣지 않고 scheme, host, port가
정확히 일치하는 origin만 쉼표로 구분한다.

`HTTP_CORS_ORIGINS`를 명시하면 `ADMIN_UI_URL` fallback을 대체한다. 따라서 기존 관리자 UI
origin을 유지해야 하는 배포는 새 외부 UI origin과 함께 목록에 포함한다. 예를 들어
`gaegaeting-dev` 연결 UI를 배포할 때의 값은 다음과 같다.

```dotenv
HTTP_CORS_ORIGINS=https://auth.rvkang.app,https://test-ggt-ui.rvkang.app
```

Doppler에 값이 존재하는 것만으로 Pod에 주입되었다고 간주하지 않는다. GitOps의
runtime-sync가 명시적 secret 이름 allowlist를 사용하면 `HTTP_CORS_ORIGINS`를 그 목록에
추가하고, workload manifest가 개별 `env.valueFrom.secretKeyRef`를 사용하면 같은 key를
container env에 명시한다. 이 저장소 기본 manifest처럼 `envFrom.secretRef`를 사용하는
환경에서도 실제 생성된 Secret에 key가 있는지 확인한다.

rollout 뒤에는 실행 중인 모든 Pod에서 변수 존재 여부만 확인하고 값 전체를 로그로 남기지
않는다. 이어서 허용된 exact origin의 credentialed preflight가 `204`, 실제 interaction
요청이 허용 origin과 `Access-Control-Allow-Credentials: true`를 반환하는지 검증한다.
임의 origin, sibling subdomain, 다른 scheme 또는 port는 계속 거부되어야 한다.

### `gaegaeting-dev` 배포 인계 기록 (2026-10-05)

다음은 배포 전 준비 상태를 기록한 스냅샷이며 다른 tenant의 설정 근거로 사용하지 않는다.

- tenant `gaegaeting-dev`의 Kakao provider는 관리 리소스 ID `2`로 등록되었다.
- provider는 `enabled: false`, `clientSecretSet: true`이며 활성화하지 않았다.
- callback은 `/t/gaegaeting-dev/interaction/idp/kakao/callback`, scope는
  `profile_nickname`으로 확인되었다.
- 등록 당시 실행 이미지는 service `0.2.1`, image digest
  `sha256:d3a9a7aa642bc150a34dd98545affd68460e12a6283fc955a27cdf9619d33889`였고
  rollout 중인 다른 service Pod는 없었다.
- client secret은 현재 운영 `JWKS_ENCRYPTION_KEY`와 동일한 key로 보호된 `enc:v1`
  형식이며 원문은 이 문서나 관리 API 조회에 남기지 않는다.
- `gaegaeting-web`의 external UI는 `https://test-ggt-ui.rvkang.app/interaction`, 등록된
  앱 복귀 URI는 `https://test-ggt-ui.rvkang.app/login`으로 확인되었다.
- Doppler `auth/prd`에는 위 `HTTP_CORS_ORIGINS` 값이 준비되었지만, K3s runtime-sync
  allowlist와 service workload의 explicit secret env 매핑은 아직 배포되지 않았다.

provider 활성화는 새 service 이미지와 migration Job 성공, CORS env 주입, readiness 확인
뒤에 수행한다. 그 전까지 비활성 상태를 유지한다. 활성화 후에는 실제 Kakao 로그인과 기존
계정 identity-link를 각각 검증하며, 실패하면 provider를 다시 비활성화하고 기존
`0.2.1` 코드로 암호문을 사용하려 하지 않는다.

## 이미지 계약

Redis 연결 코드는 service image 안에 있으므로 이 변경을 적용하려면 Auth service 이미지를 반드시 다시 빌드해야 한다. 관리자 UI 코드는 바뀌지 않으므로 Redis 변경만을 위해 UI 이미지를 다시 빌드할 필요는 없다. multi-platform workflow가 만든 동일 태그/digest manifest에서 OCI A1은 `linux/arm64` variant를 선택한다.
