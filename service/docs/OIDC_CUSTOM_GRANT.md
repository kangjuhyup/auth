# OIDC 커스텀 Grant 가이드

이 문서는 `node-oidc-provider`(현재 `^9.6.0`)를 쓰는 본 서비스에서 **Grant**를 확장하는 두 가지 의미를 구분하고, 각각의 작업 절차를 정리한다.

| 구분 | 의미 | 대표 사용처 |
|------|------|-------------|
| **A. OAuth `grant_type` (토큰 엔드포인트)** | `POST /token` 에 `grant_type=...` 로 들어오는 **플로우**를 추가 | Token Exchange(RFC 8693), 사내 배포용 확장 grant 등 |
| **B. OIDC `Grant` 객체 (동의·권한 부여 기록)** | 사용자·클라이언트 쌍에 대한 **부여된 scope/리소스**를 담는 provider 내부 모델 | `skipConsent` 시 자동 부여, 동의 화면에서 scope 저장 |

혼동하기 쉬우므로 요구사항에 맞는 쪽을 먼저 고른 뒤 아래 절차를 따른다.

공통 전제:

- 프로토콜 엔진: [`node-oidc-provider`](https://github.com/panva/node-oidc-provider)
- 테넌트별로 **별도의 `Provider` 인스턴스**가 생성된다 ([`oidc-provider.factory.ts`](../src/infrastructure/oidc-provider/oidc-provider.factory.ts), [`oidc-provider.registry.ts`](../src/infrastructure/oidc-provider/oidc-provider.registry.ts)).
- 설정 본체: [`oidc-provider.config.ts`](../src/infrastructure/oidc-provider/oidc-provider.config.ts)

---

## A. 커스텀 OAuth `grant_type` 추가 (토큰 엔드포인트)

`node-oidc-provider` 는 기본 grant(예: `authorization_code`, `refresh_token` 등) 외에 **`Provider#registerGrantType`** 으로 커스텀 grant 를 등록할 수 있다. 공식 문서의 [Custom Grant Types](https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#custom-grant-types) 와 라이브러리 내 [`lib/actions/grants`](https://github.com/panva/node-oidc-provider/tree/main/lib/actions/grants) 구현을 참고하는 것이 안전하다.

### A.1 동작 개요

1. 토큰 요청이 오면 provider 가 `grant_type` 에 맞는 핸들러를 호출한다.
2. 핸들러는 Koa 스타일 **`async (ctx, next) => { ... }`** 이며, `ctx.oidc.params`, `ctx.oidc.client` 등에 접근한다.
3. 표준 grant 와 동일하게 **액세스 토큰(및 필요 시 리프레시 토큰 등)을 발급·저장**하는 로직을 구현해야 하며, 이 부분은 표준 grant 팩토리 코드를 베끼는 편이 실수가 적다.

### A.2 이 저장소에서의 권장 연동 위치

**테넌트마다** `new Provider(issuer, configuration)` 이 호출되므로, **`registerGrantType` 은 인스턴스 생성 직후, 반환하기 전에** 수행해야 모든 테넌트에 동일하게 적용된다.

권장 패턴:

1. [`createOidcProvider`](../src/infrastructure/oidc-provider/oidc-provider.factory.ts) 에서 `const provider = new Provider(...)` 이후
2. 예: `registerCustomGrantTypes(provider, params)` 같은 함수를 호출해 `provider.registerGrantType(...)` 을 모아 둔다.

```ts
// 개념 예시 (실제 경로·의존성은 프로젝트에 맞게 조정)
const provider = new Provider(params.issuer, configuration);

provider.registerGrantType(
  'urn:example:params:oauth:grant-type:demo',
  async (ctx, next) => {
    // ctx.oidc.params — 허용할 파라미터 이름은 아래 배열과 일치해야 함
    // ctx.oidc.client — 클라이언트 인증 후 주입
    // 표준 grants 구현을 참고해 토큰 발급
    await next();
  },
  ['custom_param', 'scope'], // 토큰 엔드포인트에서 파싱·허용할 파라미터 이름
  [], // allowedDuplicateParameters (필요 시 RFC8693 token-exchange 처럼 중복 허용 목록)
);

return provider;
```

### A.3 클라이언트 메타데이터와 Admin API

클라이언트가 해당 `grant_type` 을 쓰려면 **등록된 클라이언트의 `grant_types`** 에 값이 포함되어야 한다. OIDC 어댑터는 DB 의 클라이언트를 그대로 노출하므로 ([`client-oidc.adapter.ts`](../src/infrastructure/oidc-provider/adapters/client-oidc.adapter.ts)):

1. Admin API 로 클라이언트를 만들거나 수정할 때 `grantTypes` 배열에 커스텀 grant 문자열을 넣는다.
2. [`client.dto.ts`](../src/presentation/dto/admin/client.dto.ts) 의 `GRANT_TYPES` 화이트리스트에 **동일한 문자열을 추가**한다. 현재 허용 목록에 없으면 DTO 검증에서 걸린다.

### A.4 Discovery (`grant_types_supported`)

커스텀 grant 를 등록하면, 사용 중인 `node-oidc-provider` 버전에 따라 **메타데이터에 자동 반영되는지** 확인한다. 필요하면 `configuration` 의 메타데이터 관련 옵션(버전별로 상이)을 문서와 타입 정의(`@types/oidc-provider`)로 점검한다.

### A.5 보안 체크리스트

- **클라이언트 인증**: confidential 클라이언트는 `client_secret` 또는 등록된 인증 방식을 강제한다.
- **파라미터 화이트리스트**: `registerGrantType` 의 세 번째 인자로 허용 파라미터를 명시한다.
- **권한 모델**: 어떤 클라이언트가 이 grant 를 쓸 수 있는지 `grant_types` 외에도 비즈니스 규칙(테넌트 정책 등)으로 이중 검증하는 것을 권장한다.
- **감사·레이트 리밋**: 토큰 엔드포인트 남용 방지.

---

## B. OIDC `Grant` 객체 커스터마이징 (동의·자동 부여)

여기서 말하는 **Grant** 는 `provider.Grant` 클래스 인스턴스로, **accountId + clientId** 단위로 **부여된 OIDC scope / 리소스** 등을 들고 있고 adapter 를 통해 저장된다.

### B.1 자동 Grant (`loadExistingGrant`)

[`oidc-provider.config.ts`](../src/infrastructure/oidc-provider/oidc-provider.config.ts) 의 **`loadExistingGrant`** 는 동의 화면을 건너뛸 때 기존 Grant 를 불러오거나 새로 만들 수 있다.

현재 구현은 `skipConsent` 인 클라이언트에 대해 고정 scope 로 Grant 를 만든다:

- `grant.addOIDCScope('openid profile email')`

**확장 예시:**

- 클라이언트별 기본 scope 를 DB (`Client` 모델의 `scope` 등)에서 읽어 `addOIDCScope` 에 반영
- Resource Indicators / RAR 등을 쓰는 경우 provider 버전이 지원하면 `addResourceScope` 등 API 검토 (공식 문서·타입 정의 참고)

### B.2 동의(consent) interaction 이후 Grant 저장

[`interaction.controller.ts`](../src/presentation/controllers/interaction.controller.ts) 의 `submitConsent` 에서:

- `provider.Grant.find` / `new provider.Grant({ accountId, clientId })`
- `prompt.details.missingOIDCScope` 를 `grant.addOIDCScope` 로 반영
- `grant.save()` 후 `interactionResult({ consent: { grantId } })`

**추가 scope 나 커스텀 클레임**을 동의 결과에 묶으려면 이 흐름에서 Grant 에 담는 데이터를 확장하고, 이후 토큰 발급 시점의 콜백(`findAccount` 의 `claims`, JWT 설정 등)과 일관되게 맞춘다.

### B.3 Grant TTL

[`oidc-provider.config.ts`](../src/infrastructure/oidc-provider/oidc-provider.config.ts) 의 `ttl.Grant` 가 Grant 레코드 만료 시간을 결정한다. 정책에 맞게 조정한다.

---

## C. 용어 정리

- **`grant_type`**: 토큰 엔드포인트의 폼/바디 필드. 새 플로우 = **A절**.
- **`Grant` (모델)**: 인가 서버가 유지하는 “이 사용자가 이 클라이언트에 무엇을 허용했는지” = **B절**.
- **클라이언트의 `grant_types` 배열**: 해당 클라이언트가 **어떤 `grant_type` 을 token endpoint 에서 쓸 수 있는지** (Admin + DTO 화이트리스트와 연동).

---

## D. 참고 링크

- [node-oidc-provider README — Custom Grant Types](https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#custom-grant-types)
- 프로젝트 OIDC 개요: [OIDC.md](./OIDC.md)
