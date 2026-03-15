# Skill: UI (React + Vite)

## Trigger
- ui/ 디렉토리 변경
- React 컴포넌트 작성/수정
- API 통신 코드
- 상태 관리
- OIDC 인증 UI 흐름

## Rules

### Build System (Vite)
- ES modules only
- 환경변수: `import.meta.env` (VITE_ prefix 필수)
- secret은 환경변수에 절대 노출 금지
- Node-specific API 클라이언트 코드에서 금지
- CommonJS import 금지

### React + TypeScript
- 함수형 컴포넌트만 사용
- strict TypeScript 모드
- 컴포넌트는 작고 재사용 가능하게 (god component 금지)

### TanStack Query (Server State)
- 모든 API 통신은 TanStack Query 사용
- `useEffect + fetch` 패턴으로 서버 상태 관리 금지
- query key factory 중앙화 (`queryKeys.ts`)
- mutation 후 관련 query invalidation 필수
- 서버 데이터를 Zustand에 저장 금지

### Zustand (Client/UI State만)
허용:
- UI 상태 (modal, tab, toggle)
- submit 전 wizard 상태
- 로컬 설정 (theme, filter)

금지:
- 서버 authoritative 데이터 저장
- token 저장
- TanStack Query 캐시 중복

### OIDC UI 흐름
- UI에서 OIDC 로직 직접 구현 금지
- backend authorization 엔드포인트로 redirect
- JWT 수동 파싱/검증 금지
- client secret 저장 금지

### Networking
- 단일 API client 모듈 (`src/lib/apiClient.ts`)
- correlationId 첨부
- 401/403 전역 처리
- token 로깅 금지

## Do
- TanStack Query로 서버 상태 관리
- Zustand는 UI 상태만
- OIDC 흐름은 backend에 위임
- 단일 API client 사용

## Don't
- 환경변수에 secret 노출
- 수동 JWT 파싱
- client secret UI에서 저장
- 서버 데이터 Zustand에 저장

## Checklist
- [ ] 환경변수: VITE_ prefix만 사용
- [ ] 서버 상태: TanStack Query만 사용
- [ ] UI 상태: Zustand만
- [ ] OIDC 흐름: backend 위임
- [ ] token 로깅 없음
