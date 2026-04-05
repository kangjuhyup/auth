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
- 환경변수: `import.meta.env` (VITE\_ prefix 필수)
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

## Testing

### 프레임워크 및 환경

- **Vitest** + **happy-dom** (jsdom 대신 — ESM 호환 문제)
- 설정: `ui/vite.config.ts` → `test.environment: 'happy-dom'`
- 테스트 위치: `ui/test/` (절대 `ui/src/test/` 아님)
- setup 파일: `ui/test/setup.ts` (afterEach localStorage.clear + vi.clearAllMocks)

### 디렉토리 구조

```
ui/test/
 ├── setup.ts
 ├── lib/          ← apiClient, queryKeys
 ├── stores/       ← Zustand store 단위 테스트
 ├── hooks/        ← React Query 훅 (필요 시)
 └── validation/   ← form validation 패턴
```

### 테스트 대상 우선순위

1. **lib/** (apiClient, queryKeys) — 모든 API 호출 통과 지점, 캐시 키 정합성
2. **stores/** (Zustand) — 상태 전환, persist 동작
3. **validation/** — form regex 패턴, 규칙 간 차이 명세
4. **hooks/** — mutation 성공/실패 콜백 (필요 시)

### 테스트 금지 대상

- Ant Design 컴포넌트 렌더링 (Table, Form, Modal) — 레이아웃 변경마다 깨짐
- Page 컴포넌트 전체 렌더링 — 통합 테스트 영역
- mockApi.ts — 개발용 mock, 프로덕션 코드 아님

### Mock 패턴

```ts
// fetch mock
vi.stubGlobal('fetch', vi.fn());

// window.location mock
vi.stubGlobal('location', { href: '' });

// 모듈 mock (동적 import 포함)
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: { getState: vi.fn() },
}));

// Zustand store 리셋 (beforeEach)
useAuthStore.setState({ isAuthenticated: false, token: null, username: null });
```

### 규칙

- `vi.stubGlobal` 사용 후 `afterEach(() => vi.unstubAllGlobals())` 필수
- store 테스트는 `store.setState()`로 초기화, `store.getState()`로 검증
- `vi.mock()` 은 파일 최상단 (vitest 가 자동 hoist)

## Checklist

- [ ] 환경변수: VITE\_ prefix만 사용
- [ ] 서버 상태: TanStack Query만 사용
- [ ] UI 상태: Zustand만
- [ ] OIDC 흐름: backend 위임
- [ ] token 로깅 없음
- [ ] 테스트 위치: `ui/test/` 하위
- [ ] 테스트 환경: happy-dom
- [ ] fetch/location mock: vi.stubGlobal + afterEach unstub
