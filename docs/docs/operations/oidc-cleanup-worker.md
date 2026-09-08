# OIDC 만료 데이터 정리 워커

API와 동일한 `service/` 코드와 이미지를 사용하지만 독립 프로세스로 실행한다.
`main.ts`는 HTTP 서버이고, `worker.ts`는 `WorkerModule`의 Nest application context다.
워커는 HTTP 포트를 열거나 OIDC provider·Redis·관리자 bootstrap을 시작하지 않는다.
API replica마다 생성하거나 리더를 선출하지 않는다. 기본 운영 구성은 워커 1개다.

## 실행

저장소의 Node/Yarn 버전을 사용하고 `.env` 및 DB migration을 먼저 준비한다.

```bash
# 개발: API·워커·관리 UI를 함께 시작
 yarn dev
# 개발: 정리 워커만 시작
 yarn worker:dev
# 운영: 빌드 후 별도 프로세스로 시작
 yarn service:build
 yarn worker:start
```

워커는 API와 같은 우선순위로 `service/.env`, 현재 작업 디렉터리의 `.env`와 프로세스 환경을 읽는다.
개발 워커는 소스를 직접 감시하므로 API의 `dist/` 빌드와 충돌하지 않는다.
운영에서는 `service/`를 작업 디렉터리로 `node dist/worker.js`를 실행할 수도 있다.
DB 연결 풀은 워커당 최대 1개다. 여러 워커가 우연히 실행돼도 삭제 대상 행의 트랜잭션 잠금으로 경쟁을 제어한다.

Docker도 같은 Auth 이미지를 다른 명령으로 실행한다. 저장소의 로컬 PostgreSQL 구성과 함께 사용하는 예:

```bash
docker build -f deploy/docker/Dockerfile.service -t auth-service:local .
# 기존 안내에 따라 DB migration을 먼저 완료한 뒤 실행
docker compose -f docker-compose.yml -f docker-compose.worker.yml up -d oidc-cleanup-worker
docker compose -f docker-compose.yml -f docker-compose.worker.yml logs -f oidc-cleanup-worker
```

이 워커용 Compose 파일은 로컬 개발 DB 설정이다. 운영에서는 해당 배포의 DB 환경을 주입한다.
워커 명령은 이미지의 기본 migration entrypoint를 우회하며 자동으로 migration하지 않는다.
운영 프로세스 관리자에서 워커만 별도로 재시작·관측할 수 있으며 Kubernetes가 필요하지 않다.

## 삭제 정책

- `expires_at < 배치 시작 시각 − 유예시간`인 행만 삭제한다. 유예시간 기본값은 5분이다.
- 허용 종류: AccessToken, AuthorizationCode, Interaction, Session, Grant, RefreshToken.
- Session 삭제 시 동일한 tenant/session의 `oidc_session_index`도 같은 트랜잭션에서 삭제한다.
- 아직 유효한 consumed RefreshToken, 만료일 없는 행, RefreshTokenReuse 계열 마커는 삭제하지 않는다.
- 별도 고아 인덱스 정리와 보안 마커 보존 정책은 이번 작업에 포함하지 않는다.
- Redis 데이터는 수정하지 않는다. 이 작업은 RDB의 만료 데이터 정리이며, 기존 캐시 TTL은 유지된다.

| 환경 변수                  | 기본값 | 범위           |
| -------------------------- | -----: | -------------- |
| `OIDC_CLEANUP_INTERVAL_MS` |  60000 | 1000–3600000   |
| `OIDC_CLEANUP_GRACE_MS`    | 300000 | 1000–604800000 |
| `OIDC_CLEANUP_BATCH_SIZE`  |    500 | 1–1000         |
| `OIDC_CLEANUP_MAX_BATCHES` |     10 | 1–100          |
| `OIDC_CLEANUP_MAX_RUN_MS`  |   5000 | 100–60000      |

시작 직후 한 차례 실행하고 각 주기 완료 후 다음 주기를 예약한다. 이전 주기와 겹치지 않는다.
한 주기는 건수·배치 수·시간 예산으로 제한한다. 시간 예산은 **다음 배치 시작을 제한**하며 진행 중인 SQL을 강제 취소하지 않는다.
PostgreSQL은 각 트랜잭션에 잠금 대기 1초, SQL 문장 5초 제한을 적용한다.
MySQL/MSSQL에서는 해당 DB의 잠금·문장 시간 제한 설정을 사용한다.
만료 시각 인덱스는 각 DB별 `Migration20260906000000`이 추가한다.

실패 시 원본 SQL 오류나 토큰을 출력하지 않고 고정 오류 메시지를 남긴다.
재시도 간격은 설정 주기의 2배부터 최대 32배까지 증가하며 상한은 1시간이다.
SIGTERM/SIGINT 수신 시 새 배치를 중단하고 진행 중인 배치를 마친 뒤 DB 연결을 닫는다.
프로세스 관리자의 종료 유예시간은 DB 시간 제한과 배치 실행시간을 고려해 설정한다.

## 관측

독립 워커 stdout에서 시작·주기 완료·실패를 확인한다. 완료 로그는 삭제한 모델 수, 세션 인덱스 수, 배치 수, 소요 시간을 포함한다.
토큰·세션 ID·사용자 정보·DB 비밀번호는 로그에 포함하지 않는다.
프로세스 생존 여부뿐 아니라 완료 로그의 최신 시각과 실패 지속 여부를 모니터링한다.
HTTP metrics/health endpoint는 제공하지 않는다.

삭제량이 지속적으로 한 주기 상한에 도달하면 만료 데이터 생성 속도와 DB 부하를 확인해 주기 또는 배치 상한을 조정한다.
삭제 직후 DB 파일 크기가 줄어드는 것을 성공 기준으로 삼지 않는다. 일반 DELETE 후 공간 재사용과 autovacuum 상태를 함께 확인한다.

## 검증

```bash
yarn dev:test
yarn workspace @auth/service test:unit test/infrastructure/oidc-provider/cleanup test/worker.spec.ts
# 별도 PostgreSQL 테스트 DB URL을 설정하면 격리된 스키마에서 통합 테스트 실행
OIDC_POSTGRES_TEST_URL="$TEST_DATABASE_URL" yarn workspace @auth/service test:unit test/integration/oidc-cleanup.integration.spec.ts
```

개발 기본 실행에 워커가 포함되므로 성능 비교 실험에서는 워커 실행 여부를 조건에 기록한다.
