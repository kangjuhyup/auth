# Skill: Naming

## Trigger
- 신규 파일 추가
- 파일명 수정
- 클래스명 수정

본 규칙은 레이어별 DTO 및 클래스 네이밍을 명확히 구분하기 위해 사용한다.

레이어별 명명 규칙은 다음과 같다.

| Layer | Type | Example |
|------|------|------|
| Controller | Request | CreateClientBody |
| Controller | Response | CreateClientResponse |
| Application | Command | CreateClientCommand |
| Application | Query | GetClientQuery |
| Query Result | View | ClientView |
| Infrastructure | Payload | OidcIntrospectionPayload |
| Infrastructure | Result | OidcIntrospectionResult |

---

# 1. Controller (Presentation Layer)

외부 API 계약을 정의하는 레이어이다.

외부 요청 DTO는 **Request / Response** 를 사용한다.

## Controller

### File
```
<resource>.controller.ts
```

### Class
```
<Resource>Controller
```

예시

```
client.controller.ts
```

```
ClientController
```

---

## Controller DTO

### Request DTO

외부 API 입력을 정의한다.

#### File
```
<action>-<resource>-request.dto.ts
```

#### Class

Body / Query / Param / Header 로 구분한다.

```
<Action><Resource>Body
<Action><Resource>Query
<Action><Resource>Param
<Action><Resource>Header
```

예시

```
create-client-request.dto.ts
```

```
CreateClientBody
CreateClientQuery
CreateClientParam
```

---

### Response DTO

외부 API 응답을 정의한다.

#### File
```
<action>-<resource>-response.dto.ts
```

#### Class
```
<Action><Resource>Response
```

예시

```
create-client-response.dto.ts
```

```
CreateClientResponse
```

---

# 2. Application Layer (CQRS)

Application 레이어는 **Command / Query 기반 CQRS 구조**를 사용한다.

외부 API 계약(Request/Response)과 분리하기 위해 **Command / Query / View**를 사용한다.

---

## Command

쓰기 작업을 수행하는 UseCase

### File
```
<action>-<resource>.command.ts
```

### Class
```
<Action><Resource>Command
```

예시

```
create-client.command.ts
```

```
CreateClientCommand
```

---

## Query

읽기 작업을 수행하는 UseCase

### File
```
get-<resource>.query.ts
list-<resource>.query.ts
find-<resource>.query.ts
```

### Class
```
Get<Resource>Query
List<Resource>Query
Find<Resource>Query
```

예시

```
get-client.query.ts
```

```
GetClientQuery
```

---

## Query Result (Read Model)

Query 결과는 **Response 대신 View**를 사용한다.

이는 **API Response와 Read Model을 구분하기 위함**이다.

### File
```
<resource>.view.ts
```

### Class
```
<Resource>View
<Resource>DetailView
<Resource>ListItem
```

예시

```
client.view.ts
```

```
ClientView
```

---

# 3. Infrastructure Layer

외부 시스템과 통신하는 Adapter 레이어이다.

Controller DTO(Request/Response)와 혼동을 피하기 위해  
**Payload / Result** 를 사용한다.

---

## Payload

외부 시스템 요청 데이터

### File
```
<adapter>-payload.ts
```

### Class
```
<Provider><Action>Payload
```

예시

```
oidc-introspection.payload.ts
```

```
OidcIntrospectionPayload
```

---

## Result

외부 시스템 응답 데이터

### File
```
<adapter>-result.ts
```

### Class
```
<Provider><Action>Result
```

예시

```
oidc-introspection.result.ts
```

```
OidcIntrospectionResult
```

---

# Naming Summary

레이어별 DTO 타입은 반드시 다음 규칙을 따른다.

| Layer | DTO Type |
|------|------|
Controller | Request / Response |
Application | Command / Query |
Query Result | View |
Infrastructure | Payload / Result |

이 규칙을 통해 다음을 보장한다.

- API 계약과 UseCase 입력 모델 분리
- CQRS 구조 명확화
- Infrastructure DTO와 API DTO 혼동 방지
- 레이어 책임 명확화