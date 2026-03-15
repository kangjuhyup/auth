# Skill: Architecture

## Trigger
- 레이어 추가/이동
- 의존성 방향 변경
- 모듈/포트 구조 변경
- 레이어 간 로직 이동

## Rules

### Dependency Direction (STRICT)
```
presentation → application → domain
infrastructure → application → domain
```

Domain must NEVER depend on:
- NestJS, MikroORM, node-oidc-provider
- decorators, persistence entities, framework exceptions

### Layer Responsibilities
- **domain**: 순수 TS. 비즈니스 invariant, 이벤트 emit
- **application**: ports 정의, command/query handler, DTO
- **infrastructure**: persistence, cache, crypto, oidc-provider glue
- **presentation**: HTTP 진입점. controller → application handler 위임만

### DTO Pattern (모든 레이어 공통)
모든 DTO는 반드시 `private constructor` + `static of()` factory 패턴을 사용한다.

```typescript
// 올바른 DTO 패턴
export class CreateUserDto {
  private constructor(
    readonly username: string,
    readonly password: string,
    readonly email?: string,
  ) {}

  static of(params: { username: string; password: string; email?: string }): CreateUserDto {
    return new CreateUserDto(params.username, params.password, params.email);
  }
}
```

- `new DTO()` 직접 생성 금지 (항상 `static of()` 사용)
- presentation/dto (Request DTO): class-validator 데코레이터 필수 적용 (엄격한 입력 검증)
- application/dto: class-validator 금지, 순수 데이터 컨테이너

### Ports & Adapters
- application 레이어는 port interface만 정의 (infra 구현 금지)
- infrastructure에서 port를 구현 (Adapter)
- controller는 port를 직접 호출하지 않음 (handler를 통해서만)

## Do
- DTO는 항상 `private constructor` + `static of()` 패턴
- provider 설정 코드는 infrastructure/oidc-provider 에만
- port는 application/commands/ports 또는 application/query/ports 에 위치

## Don't
- domain에 NestJS/MikroORM import
- controller에 비즈니스 로직 배치
- `new DTO()` 직접 호출
- port 구현체를 application 레이어에 배치

## Checklist
- [ ] domain: 프레임워크 import 없음
- [ ] DTO: `private constructor` + `static of()` 패턴 사용
- [ ] infrastructure: persistence/adapter만
- [ ] controller: handler 위임만
- [ ] ports: application 레이어에 interface로 정의됨
