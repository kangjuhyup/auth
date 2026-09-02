# k6 로컬 단일 인스턴스 용량 테스트 설계

## 1. 목적

로컬 Docker에서 실행되는 `auth-service` 단일 인스턴스가 실제 사용 패턴을 모사한 OIDC 트래픽을 얼마나 수용할 수 있는지 측정한다.

이 테스트는 다음 질문에 답해야 한다.

- 정해진 SLO를 만족하는 최대 동시 활성 사용자 수는 얼마인가?
- 그 동시 사용자 수를 30분 동안 유지할 수 있는가?
- 한계를 넘었을 때 어떤 엔드포인트 또는 컨테이너 자원이 먼저 병목이 되는가?

결과는 테스트를 실행한 로컬 장비와 Docker 자원 조건에 종속된다. 설정한 탐색 상한까지 모두 통과하면 그 상한을 최대치로 단정하지 않고, 최소 보장 관측값으로 보고한다.

## 2. 범위

### 포함

- Authorization Code + PKCE S256 전체 로그인 흐름
- Opaque access token introspection
- UserInfo 조회
- Refresh Token 교환과 rotation
- Discovery 및 JWKS 조회
- Token revoke/logout 후 재로그인
- 보안 rate limit 동작 확인 프로파일
- rate limit의 영향을 분리한 단일 인스턴스 용량 측정 프로파일
- PostgreSQL, Redis, 서비스 및 k6를 위한 격리된 Docker Compose 환경
- 테스트 데이터 자동 준비와 정리
- 단계별 용량 탐색, 정밀 탐색, 30분 지속 검증
- 결과 보고서와 Docker 자원 사용량 수집

### 제외

- Kubernetes HPA 또는 다중 replica 용량
- 외부 IdP, SAML, MFA, 이메일/SMS 같은 외부 연동 부하
- 관리자 CRUD 처리량
- 실제 운영 환경 또는 원격 환경에 대한 기본 실행
- CI에서의 전체 용량 및 30분 지속 테스트
- 서비스 애플리케이션 계층이나 OIDC 프로토콜 구현 변경

## 3. 성공 기준

각 측정 구간과 최종 30분 지속 구간은 다음 조건을 모두 충족해야 통과한다.

- 요청 실패율이 1% 미만이다.
- 전체 및 핵심 엔드포인트의 p95 응답 시간이 1초 미만이다.
- 전체 및 핵심 엔드포인트의 p99 응답 시간이 2초 미만이다.
- 정상 OIDC 사용자 흐름의 k6 check 실패가 없다.
- `auth-service`가 비정상 종료되거나 재시작되지 않는다.
- PostgreSQL 또는 Redis 연결 오류가 없다.

보안 프로파일에서 의도한 429 응답은 정책 동작 여부를 확인하는 별도 지표로 기록하며, 용량 프로파일의 실패율과 섞지 않는다.

## 4. 실행 아키텍처

저장소 루트의 `docker-compose.load.yml`은 다음 서비스를 전용 네트워크와 전용 볼륨에서 실행한다.

- `auth-service`: `deploy/docker/Dockerfile.service`로 빌드한 단일 인스턴스
- `postgres-load`: 테스트 전용 PostgreSQL
- `redis-load`: 테스트 전용 Redis
- `k6`: 내부 Docker DNS를 통해 `auth-service`에 요청하는 부하 발생기

기존 `docker-compose.yml`과 개발용 PostgreSQL/Redis 데이터는 사용하거나 변경하지 않는다. 테스트용 Compose project name, container name, network, volume은 일반 개발 환경과 충돌하지 않도록 전용 이름을 사용한다.

서비스는 테스트 전용 issuer와 데이터베이스, Redis에 연결한다. 서비스 이미지의 기존 entrypoint와 migration 경로를 그대로 사용한다. 용량 프로파일에서도 rate limit을 비활성화하지 않는다. 기본값은 `HTTP_THROTTLE_LIMIT=1000000`, `LOGIN_RATE_LIMIT_IP_MAX=100000`으로 설정하고 필요하면 환경 변수로 더 높일 수 있게 하여, 정책 코드 경로는 유지하면서 로컬 단일 IP 제한이 서버 용량 측정보다 먼저 개입하지 않게 한다.

## 5. 테스트 데이터

측정 전에 다음 리소스를 자동 준비한다.

- `loadtest-*` 규칙의 전용 tenant
- Authorization Code, Refresh Token, PKCE S256을 지원하고 consent를 생략하는 public client
- Opaque token introspection을 위한 confidential service client
- 설정한 최대 VU 수만큼의 고유 사용자

각 VU는 자기 번호에 대응하는 고유 사용자만 사용한다. 비밀번호와 client secret은 gitignore된 로컬 환경 파일 또는 실행 환경 변수로만 전달한다. 토큰, authorization code, PKCE verifier, 비밀번호, client secret은 로그, metric label, 결과 파일에 기록하지 않는다.

테스트 종료 또는 인터럽트 시 전용 Compose 환경과 볼륨을 정리한다. 정리 대상은 전용 project name으로 정확히 한정한다. 기존 개발 컨테이너와 볼륨은 정리 대상이 아니다.

## 6. 사용자 트래픽 모델

각 k6 VU는 독립된 cookie jar와 다음 OIDC 상태를 가진다.

- 고유 사용자 credential
- PKCE verifier/challenge
- state 및 nonce
- 현재 access token과 refresh token

VU는 시작할 때 다음 전체 로그인 흐름을 한 번 수행한다.

1. `/t/:tenantCode/oidc/auth`
2. `/t/:tenantCode/interaction/:uid/api/details`
3. `/t/:tenantCode/interaction/:uid/api/login`
4. provider resume redirect
5. `/t/:tenantCode/oidc/token`

그 후 1~3초의 think time을 두고 다음 행동을 가중치로 선택한다.

| 비중 | 행동 |
| ---: | --- |
| 45% | Opaque access token introspection |
| 25% | UserInfo 조회 |
| 12% | Refresh Token 교환 후 회전된 token 상태 저장 |
| 8% | Discovery 조회 |
| 5% | JWKS 조회 |
| 5% | revoke/logout 후 전체 로그인 재수행 |

Refresh Token 교환이 성공하면 반드시 새 refresh token으로 교체한다. 이전 refresh token을 부하 시나리오에서 재사용하지 않는다. Consent는 전용 client에서 생략하지만 redirect URI 검증, PKCE S256, provider session/interaction, token 서명과 검증은 `node-oidc-provider`의 실제 경로를 사용한다.

## 7. 프로파일

### 7.1 보안 설정 유지 프로파일

기본 rate limit 설정을 유지한 상태에서 단일 IP 트래픽이 의도한 429 응답을 발생시키는지 확인한다. 이 프로파일은 서버 최대 용량을 계산하지 않는다. 다음을 별도로 보고한다.

- 최초 429 응답 시점
- 제한 대상 경로
- 예상 제한 응답과 예상하지 않은 4xx/5xx의 구분
- 서비스 안정성

### 7.2 용량 측정 프로파일

로컬 테스트 전용 환경에서 `HTTP_THROTTLE_LIMIT=1000000`, `LOGIN_RATE_LIMIT_IP_MAX=100000`을 기본으로 설정한다. 그 외 OIDC와 보안 검증 경로는 유지한다. 이 프로파일에서만 최대 동시 사용자와 30분 지속 여부를 판정한다.

러너는 보안 프로파일을 완료한 뒤 `auth-service`를 용량 프로파일 환경 변수로 재생성하고 health가 정상화될 때까지 기다린 다음 용량 측정을 시작한다. PostgreSQL과 Redis의 전용 데이터는 이 재시작 동안 유지한다.

## 8. 용량 탐색 알고리즘

기본 최대 탐색 상한은 1,000 VU이며 환경 변수로 조정할 수 있다.

1. 1 VU smoke test로 데이터와 전체 OIDC 흐름을 검증한다.
2. `10, 25, 50, 100, 200, 400, 800, 1000` VU 순서로 1차 탐색한다.
3. 각 실행은 1분 안정화와 3분 측정으로 구성한다.
4. 최초 실패 구간에서 탐색을 중단한다.
5. 마지막 성공값과 최초 실패값 사이를 이분 탐색한다.
6. 성공/실패 구간의 차이가 5 VU 이하 또는 성공값의 10% 이하가 되면 정밀 탐색을 종료한다.
7. 마지막 성공 VU에서 30분 지속 테스트를 실행한다.

최초 탐색값인 10 VU가 실패하면 1~10 VU 구간을 같은 방식으로 정밀 탐색한다. 설정된 상한까지 모두 통과하면 결과는 “최소 N VU를 30분간 통과”로 표현한다.

정상적인 SLO 임계점 도달은 측정 결과이지 하네스 오류가 아니다. 하네스는 마지막 통과 구간과 최초 실패 구간을 모두 보존하고 다음 판정 단계로 진행한다.

## 9. 측정과 관측성

k6는 전체 결과와 함께 다음 그룹의 custom metric을 기록한다.

- 전체 정상 요청 latency 및 실패율
- authorize/interaction/login/token 전체 로그인 경로
- introspection
- userinfo
- refresh token
- discovery
- JWKS
- revoke/logout
- OIDC flow check 성공률
- 보안 프로파일의 예상 429 비율

호스트 러너는 주기적으로 다음 정보를 수집한다.

- 각 Docker 컨테이너의 CPU, 메모리, 네트워크 I/O
- 컨테이너 상태와 restart count
- 실행 전 로컬 장비, Docker, k6 및 서비스 이미지 정보
- PostgreSQL 연결 수와 Redis 연결 수·메모리 상태

Metric label에는 tenant code와 endpoint group처럼 cardinality가 제한된 값만 사용한다. 사용자 ID와 모든 credential/token 값은 label에 넣지 않는다.

## 10. 결과물

각 실행 결과는 gitignore된 `load-tests/results/<timestamp>/`에 저장한다.

- `environment.json`: 민감 값을 제거한 장비와 실행 환경
- `docker-stats.csv`: 시간대별 컨테이너 자원 사용량
- 단계별 k6 summary 원본
- `capacity.json`: 단계별 판정, 마지막 성공값, 최초 실패값
- `soak.json`: 30분 지속 결과와 최초 위반 시점
- `summary.md`: 사람이 읽을 수 있는 최종 결론

`summary.md`에는 다음을 명시한다.

- 측정 장비와 컨테이너 구성
- 적용한 트래픽 비중과 SLO
- 최대 통과 VU 또는 최소 보장 VU
- 30분 유지 성공 여부
- 실패한 경우 최초 실패 시점과 위반 지표
- 단계별 VU, RPS, p95, p99, 실패율
- 병목으로 추정되는 endpoint/container와 그 근거

## 11. 오류 처리와 안전장치

- 기본 target은 전용 Compose DNS, `localhost`, `127.0.0.1`만 허용한다.
- 원격 target은 별도의 명시적 override 없이는 실행을 거부한다.
- preflight에서 health, discovery, 준비 데이터, k6 전체 로그인 흐름을 확인한다.
- 준비 실패, 요청 모델 오류, 결과 파싱 실패는 하네스 오류로 처리하고 용량 결과와 구분한다.
- 측정 중 서비스 컨테이너가 종료되거나 재시작되면 해당 구간은 실패로 판정한다.
- `SIGINT`, `SIGTERM`, 예외 시에도 정확히 한정된 전용 Compose 리소스를 정리한다.
- 결과 정제 단계는 secret/token 형태의 필드를 allowlist 기반으로 제외한다.

## 12. 구현 경계

예상 구현 파일은 다음과 같다.

- `docker-compose.load.yml`
- `load-tests/.env.load.example`
- `load-tests/k6/` 아래 OIDC 흐름, 트래픽, metric 모듈
- `load-tests/run-capacity.mjs`
- `load-tests/README.md`
- 러너의 단계 계산, SLO 판정, 결과 정제, cleanup 단위 테스트
- 루트 `package.json`의 load test 실행 스크립트
- 결과 및 로컬 secret 파일을 제외하기 위한 `.gitignore` 갱신

서비스의 domain, application, infrastructure, presentation 코드와 기존 OIDC provider 설정은 변경하지 않는다.

## 13. 검증 전략

TDD로 러너의 순수 로직을 먼저 검증한다.

- coarse VU 단계 생성과 사용자 지정 상한
- 성공/실패 bracket과 이분 탐색 종료 조건
- SLO 경계값 판정
- 의도한 보안 429와 실제 오류의 구분
- 결과 allowlist와 secret/token 제거
- 하네스 오류와 용량 실패의 종료 상태 구분
- 인터럽트 시 전용 cleanup 호출

구현 후 다음 검증을 수행한다.

- Node 단위 테스트
- `docker compose config` 구성 검사
- k6 script inspect 또는 동등한 정적 검사
- 1 VU smoke test
- 보안 설정 유지 프로파일의 rate limit 검증

전체 탐색과 30분 지속 테스트는 로컬에서 명시적으로 실행하며 CI에는 포함하지 않는다.
