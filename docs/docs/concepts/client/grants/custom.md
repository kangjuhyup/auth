---
title: 커스텀
description: node-oidc-provider 기반 커스텀 OAuth grant_type 추가 절차
---

# 커스텀 Grant

| 항목           | 내용                                                                  |
| -------------- | --------------------------------------------------------------------- |
| 문서 목적      | 커스텀 OAuth `grant_type`을 서비스에 추가하는 표준 절차를 정의합니다. |
| 대상 독자      | 인증 서버 개발자, OIDC 확장 기능 구현자                               |
| 원본 운영 문서 | `service/docs/OIDC_CUSTOM_GRANT.md`                                   |
| 주요 코드 위치 | `service/src/infrastructure/oidc-provider/custom-grants`              |

## 개요

이 서비스는 OAuth/OIDC 프로토콜 엔진으로 `node-oidc-provider`를 사용합니다. 커스텀 grant는 `CustomGrantStrategy`로 정의한 뒤 provider 인스턴스 생성 직후 `Provider#registerGrantType`으로 등록하며, client 등록 정책은 `GrantTypeValidationStrategy`들을 통해 별도로 검증합니다.

:::caution
토큰 발급, client 인증, replay 방어 같은 핵심 보안 동작은 `node-oidc-provider`의 흐름을 우회하지 않아야 합니다.
:::

## 적용 범위

이 문서는 토큰 엔드포인트의 `grant_type` 확장을 다룹니다.

| 구분                           | 포함 여부 | 설명                                                |
| ------------------------------ | --------- | --------------------------------------------------- |
| 커스텀 `grant_type` 등록       | 포함      | `/token` 요청에서 새 grant flow 처리                |
| client `grantTypes` 정책 검증  | 포함      | client type, application type, 인증 방식 검증       |
| OIDC `Grant` 모델 커스터마이징 | 제외      | 사용자 동의와 scope 저장 모델은 원본 운영 문서 참고 |
| 토큰 서명 파이프라인 재구현    | 제외      | provider에 위임                                     |

## 구성 요소

| 파일                             | 책임                                          |
| -------------------------------- | --------------------------------------------- |
| `custom-grants/index.ts`         | 커스텀 grant 정의 목록                        |
| `custom-grant-type.ts`           | `CustomGrantStrategy` 타입                    |
| `register-custom-grant-types.ts` | `Provider#registerGrantType` 호출             |
| `grant-type-registry.adapter.ts` | 지원 grant 목록과 client 정책 검증            |
| `grant-type-strategies/*`        | client grant 정책 검증 strategy               |
| `oidc-provider.factory.ts`       | tenant별 Provider 생성 직후 커스텀 grant 등록 |
| `client.dto.ts`                  | 내장 grant 또는 `urn:...` 형식 입력 허용      |

## 추가 절차

1. `CUSTOM_GRANT_TYPES`에 `CustomGrantStrategy` 정의를 추가합니다.
2. `grantType`은 내장 grant와 충돌하지 않는 `urn:...` 형식으로 지정합니다.
3. `parameters`에 token endpoint에서 받을 파라미터 이름을 명시합니다.
4. `createHandler(context)`에서 provider grant handler를 반환합니다.
5. client의 `grantTypes` 배열에 동일한 grant type을 등록합니다.
6. 기본 정책으로 표현하기 어려운 client 검증이 있으면 `GrantTypeValidationStrategy`를 추가합니다.
7. registry 검증, provider 등록, DTO 검증 테스트를 추가합니다.

```ts
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

      // token 검증, client 정책 확인, 감사 이벤트 저장 등을 수행합니다.
      // token, secret, authorization code 원문은 로그에 남기지 않습니다.

      await next();
    },
  },
];
```

## Grant 정책 Strategy 확장

`allowedClientTypes`, `allowedApplicationTypes`, `requiresClientAuthentication`, `requiresGrantTypes`로 표현되는 정책은 기본 `GrantTypeValidationStrategy`가 검증합니다.

특정 custom grant에만 추가 조건이 필요하면 `service/src/infrastructure/oidc-provider/grant-type-strategies`에 strategy를 추가하고 `BUILT_IN_GRANT_TYPE_VALIDATION_STRATEGIES`에 포함합니다.

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

표준 grant의 발급, 서명, replay 방어는 strategy에서 구현하지 않습니다. strategy는 client가 해당 grant를 등록하거나 사용할 수 있는 정책만 검증합니다.

## 보안 기준

| 기준          | 설명                                                                                  |
| ------------- | ------------------------------------------------------------------------------------- |
| Client 인증   | `requiresClientAuthentication`이 필요한 grant는 `none` 인증 방식을 허용하지 않습니다. |
| 파라미터 제한 | `parameters`에 선언되지 않은 입력을 grant handler에서 사용하지 않습니다.              |
| 로그 마스킹   | token, authorization code, secret, one-time token 원문은 기록하지 않습니다.           |
| 정책 검증     | client `grantTypes` 등록 외에 `GrantTypeValidationStrategy`로 정책을 검증합니다.      |
| 테스트        | 지원 목록, disabled grant, client 인증 요구, DTO 입력을 테스트합니다.                 |

## 검증 체크리스트

- `yarn workspace @auth/service test --runInBand --watchman=false test/infrastructure/oidc-provider/grant-type-registry.adapter.spec.ts`
- `yarn workspace @auth/service test --runInBand --watchman=false test/infrastructure/oidc-provider/custom-grants/register-custom-grant-types.spec.ts`
- `yarn workspace @auth/service test --runInBand --watchman=false test/infrastructure/oidc-provider/oidc-provider.factory.spec.ts`
- `yarn workspace @auth/service test --runInBand --watchman=false test/presentation/dto/client.dto.spec.ts`
- `yarn workspace @auth/service build`

## 문제 해결

| 증상                                      | 확인 지점                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| client 생성 시 `grantTypes` 검증 실패     | `grantType`이 `urn:...` 형식인지 확인                                       |
| token endpoint에서 unsupported grant 발생 | `CUSTOM_GRANT_TYPES` 등록 여부와 `enabled` 값 확인                          |
| custom handler가 호출되지 않음            | Provider 생성 후 `registerCustomGrantTypes`가 실행되는지 확인               |
| client 인증 없이 grant 사용 가능          | `requiresClientAuthentication`과 client `tokenEndpointAuthMethod` 정책 확인 |

## 관련 문서

| 문서                                 | 설명                                |
| ------------------------------------ | ----------------------------------- |
| [Grant 개요](./overview.md)          | client grant type 정책과 검증 기준  |
| [OIDC 인증 흐름](../../oidc-flow.md) | Authorization Code + PKCE 기준 흐름 |
