# Changelog

## [0.1.0](https://github.com/kangjuhyup/auth/compare/auth-service-v0.0.1...auth-service-v0.1.0) (2026-04-05)


### Features

* IdP OAuth 설정·관리 및 AdminQueryHandler 테스트 수정 ([46c70de](https://github.com/kangjuhyup/auth/commit/46c70de8f918a8cd43b3153dbac64b22c039d7b1))
* **idp:** IdP provider slug 확장 및 스키마·엔티티 정리 ([4b0c5d4](https://github.com/kangjuhyup/auth/commit/4b0c5d499112733f92b7ec90448537f9573ca5c1))
* oidc-provider 멀티테넌트 + JWT 토글 지원 ([7472c40](https://github.com/kangjuhyup/auth/commit/7472c408d27541edfcd7d6ab9816f63d47561908))
* **oidc, event-store:** OIDC 설정 개선 및 이벤트 처리 구조 정비 ([7dca1ae](https://github.com/kangjuhyup/auth/commit/7dca1ae240091cc14170e808b0a3bdbc935fed1b))
* **service:** add admin management and transaction support ([56b2dea](https://github.com/kangjuhyup/auth/commit/56b2deab272c0a816a568c7e697fabe110d34e22))
* **service:** Application 핸들러 구현 및 orThrow 유틸 적용 ([933acc1](https://github.com/kangjuhyup/auth/commit/933acc1435747b4cd3fc65c4378ce969a91a8984))
* **service:** centralize runtime config and local infra setup ([9a4892e](https://github.com/kangjuhyup/auth/commit/9a4892eb59050a87499d7219aad58aad9aff6743))
* **service:** Client skipConsent 필드 추가 및 OIDC 동의 생략 처리 ([735e3fc](https://github.com/kangjuhyup/auth/commit/735e3fc0cb4965c7463650bfbdfe7af9c82dc73e))
* **service:** ClientAuthPolicy 도메인/인프라 레이어 추가 ([7bf8b8c](https://github.com/kangjuhyup/auth/commit/7bf8b8c69d2145469d537f5eba81431216c23aff))
* **service:** IdP displayName 추가 및 로그인 버튼 동적 렌더링 ([347fb32](https://github.com/kangjuhyup/auth/commit/347fb32b155a0e019c8665034bcd1f1a50a4265d))
* **service:** IdP/MFA application 포트 및 UserQuery MFA 핸들러 추가 ([2d47b79](https://github.com/kangjuhyup/auth/commit/2d47b7926a1a810a51e839cabe5bcca4fe51e222))
* **service:** IdP/MFA infrastructure 어댑터 및 리포지토리 구현체 추가 ([11e7b76](https://github.com/kangjuhyup/auth/commit/11e7b76b80875eff1435bbb4ff20468e4499d168))
* **service:** IdP/UserIdentity 도메인 모델 및 리포지토리 추가 ([05360ec](https://github.com/kangjuhyup/auth/commit/05360ec40778b74870690382cb1766325819892a))
* **service:** InteractionController를 JSON API 기반으로 리팩터링 ([ec1d2f9](https://github.com/kangjuhyup/auth/commit/ec1d2f9af835d089260d4b10cbc81620b11e05dc))
* **service:** mikroORM 트랜잭션 데코레이터 추가 ([4d829d0](https://github.com/kangjuhyup/auth/commit/4d829d05c0bebb98e7482447836f0ef7ea553609))
* **service:** OIDC Interaction 컨트롤러 및 뷰 레이어 추가 ([9122e56](https://github.com/kangjuhyup/auth/commit/9122e5623bad5da2180875988901a38dfd3718be))
* **service:** OIDC Provider 동적 토큰 TTL 적용 ([5df1420](https://github.com/kangjuhyup/auth/commit/5df14208a09fd9b5a52ef496aaf631a1437ce6f7))
* **service:** Tenant/Client 토큰 만료 시간(TTL) 도메인 모델 추가 ([f04a330](https://github.com/kangjuhyup/auth/commit/f04a33063b63a6b327ae4c73f18237d674bd7660))
* **service:** UserQueryPort authenticate 메서드 추가 ([aea5bda](https://github.com/kangjuhyup/auth/commit/aea5bda17490638dfca33181a80cd77bf5b22acb))
* **service:** 관리자 API·가드·테넌트 미들웨어 및 세션 컨트롤러 ([e23e2a4](https://github.com/kangjuhyup/auth/commit/e23e2a432420703d52b33e88c0f2c22378e48214))
* **service:** 도메인 레이어 확장 - Consent/Event/RoleInherit 모델 및 orThrow 유틸 추가 ([ae040a9](https://github.com/kangjuhyup/auth/commit/ae040a9dcc5d52b296ea184b7d6c7432347aae45))
* **service:** 멀티 DB 초기 마이그레이션 추가 및 OIDC 문서 업데이트 ([e58c72e](https://github.com/kangjuhyup/auth/commit/e58c72e320f646b682ee7bd9ab5d18ad98971e21))
* **service:** 역할 배정 존재 여부 조회 및 명령·인증 쿼리 연동 ([1b6f398](https://github.com/kangjuhyup/auth/commit/1b6f398f789b170a2e42c468884666b337681315))
* **service:** 인프라 레이어 확장 - 리포지토리 구현체/매퍼 추가 및 모듈 통합 ([17fc070](https://github.com/kangjuhyup/auth/commit/17fc07038f57551750feab1b7f770c722b87eadf))
* **service:** 테넌트/그룹/롤/권한 도메인 CRUD 및 롤 할당 기능 추가 ([93be187](https://github.com/kangjuhyup/auth/commit/93be187a598ee579e01ca73d872179583c04ba0b))


### Bug Fixes

* **interaction:** mfaPendingSessions 메모리 누수 수정 ([62b29b3](https://github.com/kangjuhyup/auth/commit/62b29b3b9746157630dbe4a75140b8c0e044d9cd))
* **interaction:** 정적 자산 경로와 TenantMiddleware 적용 범위 수정 ([2023dee](https://github.com/kangjuhyup/auth/commit/2023dee509de131e0c317c868c1c8f2213c13102))
* **oidc:** clientTtlCache 스탈 엔트리 제거 및 TTL 추가 ([ff5d9f7](https://github.com/kangjuhyup/auth/commit/ff5d9f777ff16cdeae0145d6df0a183efff21fb7))
* **service:** MikroORM 마이그레이션·스키마 스크립트 및 BaseEntity updatedAt 초기화 ([ab6d9e4](https://github.com/kangjuhyup/auth/commit/ab6d9e4eca77c801a07cccb68994c0b8f683c40d))
* **service:** Node 22 환경의 PBKDF2 검증 호환성 수정 ([3be96a1](https://github.com/kangjuhyup/auth/commit/3be96a199fadba596db214011e70bc6b92e24f4d))
* **service:** OIDC 라우팅·body parser·MikroORM 초기화 정리 ([3c3a12b](https://github.com/kangjuhyup/auth/commit/3c3a12b9fde8a543bda167a17c001745de2b69fd))
* **service:** PostgreSQL 초기 마이그레이션에 토큰 TTL 컬럼 직접 추가 ([e1a01fe](https://github.com/kangjuhyup/auth/commit/e1a01fe5301a16aedeaa4e705bff69e63822f2a7))
