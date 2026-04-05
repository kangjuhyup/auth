# Interaction UI 커스터마이징

OIDC authorize 흐름 중 **로그인·동의·MFA**를 담당하는 SPA입니다. 소스는 [`service/interaction-ui/`](../interaction-ui/) 워크스페이스(`@auth/interaction-ui`)에 있으며, 빌드 산출물은 Nest가 같은 오리진에서 서빙합니다.

---

## 1. 배포·서빙 구조

| 구성요소 | 역할 |
|----------|------|
| [vite.config.ts](../interaction-ui/vite.config.ts) | `base: '/interaction-assets/'` — JS/CSS는 이 prefix 아래로 빌드됨 |
| [app.module.ts](../src/app.module.ts) `ServeStaticModule` | `rootPath`: `service/interaction-ui/dist`, `serveRoot`: `/interaction-assets` |
| [interaction.controller.ts](../src/presentation/controllers/interaction.controller.ts) `GET :uid` | `interaction-ui/dist/index.html` 을 읽어 HTML 응답(프로세스 내 **캐시** 1회) |

운영·스테이징에서는 **반드시** 루트에서 `yarn interaction-ui:build`(또는 CI에서 동일) 후 백엔드를 배포합니다. `dist`가 없으면 `Interaction UI not built` JSON이 반환됩니다.

---

## 2. 런타임 전제 (바꾸기 어려운 부분)

- 브라우저는 **`{OIDC_ISSUER}/t/{tenantCode}/interaction/{uid}`** 에서 SPA를 로드합니다.
- API 클라이언트 [`api/client.ts`](../interaction-ui/src/api/client.ts)는 `apiBase()`를 **`window.location.pathname`** 으로 두어, 같은 경로 아래의 상대 URL로 요청합니다.

  ```text
  GET  {pathname}/api/details
  POST {pathname}/api/login
  …
  ```

  따라서 **프록시 없이 Vite 단독 개발 서버만 띄우면** API가 다른 포트로 가서 동작하지 않습니다. 로컬에서 실제 플로우를 보려면 Nest 오리진에서 빌드된 번들을 쓰거나, Vite에 `/t` 등을 백엔드로 넘기는 프록시를 별도로 구성해야 합니다.

- 정적 자산 요청은 **`/interaction-assets/assets/...`** 입니다. `base`를 바꾸면 [index.html](../interaction-ui/index.html) 생성 규칙과 Nest `serveRoot`를 **함께** 맞춰야 합니다.

---

## 3. 백엔드와의 API 계약

프론트가 호출하는 경로(모두 `InteractionController` prefix `t/:tenantCode/interaction` 아래)는 다음과 같습니다.

| 메서드 | SPA에서 쓰는 경로(상대) | 설명 |
|--------|-------------------------|------|
| GET | `./api/details` | `prompt`, `clientId`, `idpList`, `mfaRequired`, `missingScopes` 등 |
| POST | `./api/login` | 비밀번호 로그인 |
| POST | `./api/mfa` | TOTP·recovery 등 MFA 제출 |
| GET | `./api/mfa/webauthn-options` | WebAuthn 옵션 조회 |
| POST | `./api/consent` | 동의 제출 |
| GET | `./api/abort` | 인터랙션 취소 |
| GET | `./idp/:provider` | 외부 IdP로 브라우저 리다이렉트(전체 페이지) |
| GET | `./idp/:provider/callback` | IdP 콜백(서버 처리, SPA 아님) |

**커스터마이징 시** 새 필드·새 API를 추가하려면 `InteractionController`와 `api/client.ts`·`InteractionDetails` 타입을 **양쪽**에서 맞춥니다. 응답 형식을 바꾸면 [`App.tsx`](../interaction-ui/src/App.tsx)의 분기(`prompt === 'login'` 등)도 검토합니다.

---

## 4. UI·스타일 커스터마이징

### 4.1 전역 스타일

- [`index.css`](../interaction-ui/src/index.css) — 레이아웃, `.card`, `.btn`, `.btn-primary`, 폼 요소 등. **브랜드 색·타이포·다크 모드**는 여기서 조정하는 것이 가장 단순합니다.
- [`main.tsx`](../interaction-ui/src/main.tsx)에서 CSS import 순서만 바꾸지 않도록 주의합니다.

### 4.2 페이지·컴포넌트

| 경로 | 역할 |
|------|------|
| [App.tsx](../interaction-ui/src/App.tsx) | `getDetails()` 후 `login` / `consent` / `error` 라우팅, MFA 진입 |
| [pages/LoginPage.tsx](../interaction-ui/src/pages/LoginPage.tsx) | ID/PW 폼, `idpList` 기반 IdP 버튼 |
| [pages/ConsentPage.tsx](../interaction-ui/src/pages/ConsentPage.tsx) | 스코프 동의 |
| [pages/MfaPage.tsx](../interaction-ui/src/pages/MfaPage.tsx) + `components/Mfa*.tsx` | MFA UI |
| [components/IdpButton.tsx](../interaction-ui/src/components/IdpButton.tsx) | 소셜 버튼 표시 |

문구·레이아웃·접근성(라벨, `autocomplete`)은 위 컴포넌트를 직접 수정하면 됩니다. **새 prompt 종류**를 지원하려면 `node-oidc-provider` interaction과 `App.tsx` 분기, 그리고 필요 시 컨트롤러에 API를 추가합니다.

### 4.3 외부 IdP 버튼

- `details.idpList`는 테넌트에 등록된 활성 Identity Provider 목록입니다([`getDetails`](../src/presentation/controllers/interaction.controller.ts)에서 조회).
- 클릭 시 `window.location.href = getIdpUrl(provider)` → `GET .../interaction/{uid}/idp/{provider}` 로 이동합니다. 버튼 스타일·정렬만 바꿀 경우 `IdpButton`·`LoginPage`면 충분합니다.

### 4.4 국제화(i18n)

현재 저장소 기본은 한국어 하드코딩입니다. i18n 라이브러리를 도입할 경우 `pages/*`·`components/*`의 문자열만 치환 레이어로 옮기면 됩니다.

---

## 5. 빌드·검증

```bash
# 루트 또는 service 상관없이 워크스페이스 스크립트
yarn interaction-ui:build
```

- TypeScript 검사 + Vite 빌드가 [`package.json`](../interaction-ui/package.json) 스크립트에 정의되어 있습니다.
- 백엔드는 기동 시 **`index.html`을 메모리에 캐시**하므로, HTML을 고친 뒤에는 **Nest 프로세스를 재시작**해야 반영됩니다. JS/CSS는 파일명 해시가 바뀌므로 보통 캐시 이슈는 적습니다.

---

## 6. `base` / 정적 경로를 바꿀 때

1. [vite.config.ts](../interaction-ui/vite.config.ts)의 `base`
2. [app.module.ts](../src/app.module.ts)의 `ServeStaticModule.serveRoot`
3. (필요 시) 리버스 프록시에서 동일 경로로 라우팅

세 곳을 일치시키지 않으면 MIME 오류·404가 납니다.

---

## 7. 관련 문서·코드

- 프로토콜·interaction 세션 개요: [OIDC.md](./OIDC.md) §4.6
- OIDC 공개 엔드포인트 명세: [ENDPOINTS.md](./ENDPOINTS.md)

핵심 파일:

- [interaction.controller.ts](../src/presentation/controllers/interaction.controller.ts)
- [interaction-ui/src/api/client.ts](../interaction-ui/src/api/client.ts)
