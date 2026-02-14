# Auth Service

OIDC 인가 서버. `node-oidc-provider` 기반으로 멀티테넌트 인증/인가를 제공한다.

---

## 기술 스택

- NestJS
- MikroORM (PostgreSQL / MySQL / MSSQL 지원)
- node-oidc-provider (OIDC 엔진)
- Clean Architecture + DDD + Hexagonal(Ports/Adapters)
- CQRS (엄격 분리) + Event Sourcing (비즈니스 애그리거트)
- Jest (TDD)

DB 설정/마이그레이션은 `DATABASE.md` 참고.

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
- 멀티 애그리거트 워크플로우(Process Manager / Saga)
- 운영 안전성(멱등, 레이트리밋, 관측성)

---

## 아키텍처 개요

`service/`는 다음 의존성 방향을 강제한다:

- `presentation → application → domain`
- `infrastructure → application → domain`

Domain은 외부 패키지에 의존하지 않는다.

---

## 디렉토리 구조
src/
├── domain/
│    ├── models/                 # 도메인 모델(애그리거트/엔티티/VO)
│    ├── events/                 # DomainEvent 정의 및 이벤트 타입
│    ├── errors/                 # 도메인 에러
│    └── repositories/           # (필요 시) 도메인 레벨 인터페이스
│
├── application/
│    ├── command/
│    │    ├── commands/
│    │    ├── handlers/
│    │    └── ports/
│    ├── query/
│    │    ├── queries/
│    │    ├── handlers/
│    │    └── ports/
│    ├── ports/                  # command/query 공용 포트(예: PasswordHasherPort)
│    └── process-managers/       # 사가/프로세스 매니저
│
├── infrastructure/
│    ├── oidc-provider/          # provider bootstrap + adapter glue
│    ├── mikro-orm/
│    │    ├── entities/          # persistence models ONLY
│    │    ├── migrations/
│    │    └── config/
│    ├── event-store/            # ES 이벤트 저장소 구현
│    ├── projections/            # read model projector
│    ├── repositories/           # adapter 구현
│    ├── cache/                  # discovery/jwks 캐시
│    ├── crypto/                 # 해시/키 material 처리
│    └── observability/
│
├── presentation/
│    ├── controllers/            # admin api, health 등
│    └── http/                   # middleware/filters
│
└── main.ts
---

## CQRS 규칙

### Command (Write)
- 한 Command는 한 Aggregate만 변경한다.
- 불변성(invariants)은 도메인 모델에서만 검증한다.
- write side는 **event store**로만 결정한다 (projection 조회 금지).

### Query (Read)
- query handler는 projection/read model만 읽는다.
- event store/aggregate 로딩 금지.

---

## Event Sourcing 규칙

- 이벤트 저장소는 append-only
- 이벤트는 immutable & 과거형 이름
- optimistic concurrency 사용 (expectedVersion)
- 이벤트 삭제/수정 금지 (필요 시 보상 이벤트)

### 핵심 테이블
- `es_events`: 도메인 이벤트 저장소 (write side)
- `projection_checkpoint`: 프로젝션 멱등성/중복 방지 (read side)

DB 상세는 `DATABASE.md` 참고.

---

## 핵심 실행 흐름

### Command 처리 흐름(공통)
1) EventStore에서 해당 aggregate 이벤트 로드
2) DomainModel.rehydrate(events)로 현재 상태 복원
3) 도메인 메서드 실행(불변성 검증 + 이벤트 기록)
4) pullEvents()로 신규 이벤트 추출
5) EventStore.save(aggregateId, newEvents, expectedVersion)
6) EventBus.publishAll(newEvents)
7) Projector가 read model 반영 (withProjectionCheckpoint로 멱등 보장)

> Projector는 ORM entity를 “단순 매핑”으로 갱신한다.  
> 도메인 로직/불변성은 projector에 두지 않는다.

---

## 보안 원칙

- 절대 로그에 비밀번호/토큰/시크릿/키 원문을 남기지 않는다.
- PKCE는 모든 public client에 필수(S256 only).
- 키 로테이션 시 JWKS 오버랩 윈도우 유지 + 캐시 purge
- 커스텀 클레임은 최소/결정론적/정책 기반으로만 추가

---

## 개발/테스트

### 테스트 전략
1) Domain 테스트(불변성 + 이벤트)
2) Command handler 테스트(event store/bus mock)
3) Projector 테스트(멱등/버전 처리)
4) Query handler 테스트(read model mapping)
5) 통합/E2E(node-oidc-provider 엔드포인트)

### 실행
```bash
yarn workspace @auth/service test
yarn workspace @auth/service build
yarn workspace @auth/service start:dev