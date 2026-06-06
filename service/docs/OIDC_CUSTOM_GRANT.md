# OIDC 커스텀 Grant 가이드

이 문서는 `node-oidc-provider`(현재 `^9.6.0`)를 쓰는 본 서비스에서 **Grant**를 확장하는 두 가지 의미를 구분하고, 각각의 작업 절차를 정리한다.

| 구분                                           | 의미                                                                          | 대표 사용처                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| **A. OAuth `grant_type` (토큰 엔드포인트)**    | `POST /token` 에 `grant_type=...` 로 들어오는 **플로우**를 추가               | Token Exchange(RFC 8693), 사내 배포용 확장 grant 등  |
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

### A.2 이 저장소에서의 연동 위치

커스텀 grant 확장점은 아래 파일들로 분리되어 있다.

| 파일                                                                                                                 | 역할                                          |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| [`custom-grants/index.ts`](../src/infrastructure/oidc-provider/custom-grants/index.ts)                               | 커스텀 grant handler strategy 목록            |
| [`custom-grant-type.ts`](../src/infrastructure/oidc-provider/custom-grants/custom-grant-type.ts)                     | `CustomGrantStrategy` 타입                    |
| [`register-custom-grant-types.ts`](../src/infrastructure/oidc-provider/custom-grants/register-custom-grant-types.ts) | `Provider#registerGrantType` 호출             |
| `custom_grant` DB table                                                                                              | tenant별 custom grant metadata                |
| [`grant-type-registry.adapter.ts`](../src/infrastructure/oidc-provider/grant-type-registry.adapter.ts)               | DB metadata와 코드 strategy 합성, 정책 검증   |
| [`grant-type-strategies`](../src/infrastructure/oidc-provider/grant-type-strategies)                                 | client grant 정책 검증 strategy               |
| [`oidc-provider.factory.ts`](../src/infrastructure/oidc-provider/oidc-provider.factory.ts)                           | tenant별 provider 생성 직후 커스텀 grant 등록 |

테넌트마다 `new Provider(issuer, configuration)` 이 호출되므로, `oidc-provider.factory.ts` 에서 provider 인스턴스 생성 직후 `registerCustomGrantTypes(...)` 가 실행된다.

### A.3 커스텀 grant 추가 절차

1. [`custom-grants/index.ts`](../src/infrastructure/oidc-provider/custom-grants/index.ts)의 `CUSTOM_GRANT_TYPES` 배열에 `CustomGrantStrategy` handler를 추가한다.
2. `grantType` 은 내장 grant와 충돌하지 않는 `urn:...` 형식으로 둔다.
3. `parameters` 에 token endpoint에서 허용할 파라미터 이름을 명시한다.
4. `createHandler(context)` 에서 `node-oidc-provider` grant handler를 반환한다.
5. Admin API로 tenant에 같은 `grantType` metadata를 등록한다.
6. 해당 grant를 사용할 클라이언트의 `grantTypes` 배열에 동일한 `grantType` 값을 추가한다.
7. 기본 정책으로 표현하기 어려운 client 검증이 있으면 `GrantTypeValidationStrategy`를 추가한다.
8. 테스트에서 registry 검증과 handler 등록을 확인한다.

예시:

```ts
// service/src/infrastructure/oidc-provider/custom-grants/index.ts
import type { CustomGrantStrategy } from './custom-grant-type';

export const CUSTOM_GRANT_TYPES: CustomGrantStrategy[] = [
  {
    grantType: 'urn:auth:grant-type:magic_link',
    displayName: 'Magic Link',
    builtIn: false,
    enabled: true,
    allowedClientTypes: ['confidential'],
    allowedApplicationTypes: ['web'],
    requiresClientAuthentication: true,
    parameters: ['magic_token', 'scope'],
    createHandler: (context) => async (ctx, next) => {
      const magicToken = ctx.oidc.params.magic_token;

      // context.userQuery / context.clientQuery / context.eventRepository 등을
      // 사용해 토큰을 검증하고 필요한 감사 이벤트를 저장한다.
      // token, secret, authorization code 원문은 로그에 남기지 않는다.

      await next();
    },
  },
];
```

`createHandler` 가 받는 `context`:

- `tenantCode`
- `configService`
- `userQuery`
- `clientQuery`
- `eventRepository`

### A.4 DB metadata 등록

코드 strategy만 추가하면 grant는 아직 tenant에서 지원되지 않는다. tenant별 `custom_grant` metadata가 있어야 discovery의 `grant_types_supported`, client `grantTypes` 검증, provider 등록 대상에 포함된다.

```http
POST /t/acme/admin/custom-grants
Content-Type: application/json

{
  "grantType": "urn:auth:grant-type:magic_link",
  "displayName": "Magic Link",
  "description": "Issue tokens from a verified magic link.",
  "enabled": true,
  "allowedClientTypes": ["confidential"],
  "allowedApplicationTypes": ["web"],
  "requiresClientAuthentication": true,
  "requiresGrantTypes": []
}
```

DB에는 실행 코드나 검증 스크립트를 저장하지 않는다. DB metadata는 tenant별 활성화와 client 정책만 표현하고, 실제 token endpoint handler는 항상 배포된 코드 strategy가 담당한다.

| 상태                  | 결과                          |
| --------------------- | ----------------------------- |
| 코드 strategy만 있음  | tenant에서 지원하지 않음      |
| DB metadata만 있음    | handler가 없어 지원하지 않음  |
| 둘 다 있고 enabled    | provider에 등록되고 사용 가능 |
| 둘 다 있지만 disabled | client 정책 검증에서 거부     |

### A.5 클라이언트 메타데이터와 Admin API

클라이언트가 해당 `grant_type` 을 쓰려면 **등록된 클라이언트의 `grant_types`** 에 값이 포함되어야 한다. OIDC 어댑터는 DB 의 클라이언트를 그대로 노출하므로 ([`client-oidc.adapter.ts`](../src/infrastructure/oidc-provider/adapters/client-oidc.adapter.ts)):

1. Admin API 로 클라이언트를 만들거나 수정할 때 `grantTypes` 배열에 커스텀 grant 문자열을 넣는다.
2. [`client.dto.ts`](../src/presentation/dto/admin/client.dto.ts) 는 내장 grant 또는 `urn:...` 형식의 커스텀 grant 문자열을 허용한다.
3. 실제 지원 여부와 client type/application type/client authentication 정책은 `GrantTypeRegistryPort` 내부의 `GrantTypeValidationStrategy`들을 통해 검증된다.

예시 요청:

```json
{
  "clientId": "magic-link-client",
  "name": "Magic Link Client",
  "type": "confidential",
  "tokenEndpointAuthMethod": "client_secret_basic",
  "grantTypes": ["urn:auth:grant-type:magic_link"]
}
```

### A.6 Grant 정책 Strategy

`allowedClientTypes`, `allowedApplicationTypes`, `requiresClientAuthentication`, `requiresGrantTypes`로 표현되는 정책은 기본 `GrantTypeValidationStrategy`들이 검증한다.

특정 custom grant에만 추가 조건이 필요하면 [`grant-type-strategies`](../src/infrastructure/oidc-provider/grant-type-strategies)에 strategy를 추가하고 `BUILT_IN_GRANT_TYPE_VALIDATION_STRATEGIES`에 포함한다.

```ts
import type { GrantTypeValidationStrategy } from './grant-type-validation-strategy';

export class MagicLinkGrantTenantStrategy implements GrantTypeValidationStrategy {
  validate({ definition, params }) {
    if (definition.grantType !== 'urn:auth:grant-type:magic_link') {
      return [];
    }

    return params.tenantId.startsWith('partner-')
      ? []
      : [{ grantType: definition.grantType, reason: 'disabled' }];
  }
}
```

이 strategy는 client가 해당 grant를 등록하거나 사용할 수 있는 정책만 검증한다. 표준 grant의 발급, 서명, replay 방어는 `node-oidc-provider` 흐름을 우회해서 구현하지 않는다.

### A.7 Discovery (`grant_types_supported`)

커스텀 grant 를 등록하면, 사용 중인 `node-oidc-provider` 버전에 따라 **메타데이터에 자동 반영되는지** 확인한다. 필요하면 `configuration` 의 메타데이터 관련 옵션(버전별로 상이)을 문서와 타입 정의(`@types/oidc-provider`)로 점검한다.

### A.8 보안 체크리스트

- **클라이언트 인증**: confidential 클라이언트는 `client_secret` 또는 등록된 인증 방식을 강제한다.
- **파라미터 화이트리스트**: `registerGrantType` 의 세 번째 인자로 허용 파라미터를 명시한다.
- **권한 모델**: 어떤 클라이언트가 이 grant 를 쓸 수 있는지 `grant_types` 외에도 비즈니스 규칙(테넌트 정책 등)으로 이중 검증하는 것을 권장한다.
- **감사·레이트 리밋**: 토큰 엔드포인트 남용 방지.
- **로그 마스킹**: token, authorization code, secret, one-time token 원문을 로그에 남기지 않는다.

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
