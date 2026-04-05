/** dependency-cruiser 금지 규칙 (단일 출처). */
const forbidden = [
  /* ---------- 레이어 간 (헥사고날) ---------- */
  {
    name: 'no-domain-to-outer-layers',
    severity: 'error',
    comment:
      'domain 은 application / infrastructure / presentation 에 의존하면 안 됩니다. (domain.module.ts 제외)',
    from: {
      path: '^src/domain',
      pathNot: 'domain\\.module\\.ts$',
    },
    to: {
      path: '^src/(application|infrastructure|presentation)/',
    },
  },
  {
    name: 'no-domain-to-nest-outside-module',
    severity: 'error',
    comment: 'domain 내부(모듈 파일 제외)에서는 @nestjs 에 직접 의존하지 않습니다.',
    from: {
      path: '^src/domain',
      pathNot: 'domain\\.module\\.ts$',
    },
    to: {
      path: 'node_modules/@nestjs/',
    },
  },
  {
    name: 'no-application-to-infrastructure',
    severity: 'error',
    comment:
      'application(핸들러·포트 등)은 infrastructure 에 직접 의존하지 않습니다. application.module.ts 예외.',
    from: {
      path: '^src/application',
      pathNot: 'application\\.module\\.ts$',
    },
    to: {
      path: '^src/infrastructure/',
    },
  },
  {
    name: 'no-application-to-presentation',
    severity: 'error',
    comment: 'application 은 presentation 에 의존하지 않습니다.',
    from: {
      path: '^src/application',
      pathNot: 'application\\.module\\.ts$',
    },
    to: {
      path: '^src/presentation/',
    },
  },
  {
    name: 'no-presentation-to-infrastructure',
    severity: 'error',
    comment:
      'presentation 은 기본적으로 infrastructure 에 의존하지 않습니다. (OIDC 예외 파일 pathNot)',
    from: {
      path: '^src/presentation',
      pathNot:
        '(session\\.controller|admin\\.guard|interaction\\.controller|oidc\\.middleware)\\.ts$',
    },
    to: {
      path: '^src/infrastructure/',
    },
  },
  {
    name: 'no-infrastructure-to-presentation',
    severity: 'error',
    comment: 'infrastructure 는 presentation 에 의존하지 않습니다. (oidc-provider.module 예외)',
    from: {
      path: '^src/infrastructure',
      pathNot: 'oidc-provider/oidc-provider\\.module\\.ts$',
    },
    to: {
      path: '^src/presentation/',
    },
  },

  /* ---------- domain 내부 구조 ---------- */
  {
    name: 'domain-models-not-to-repositories',
    severity: 'error',
    comment: 'domain/models 는 domain/repositories 를 참조하지 않습니다 (모델이 저장소 추상에 묶이지 않도록).',
    from: { path: '^src/domain/models' },
    to: { path: '^src/domain/repositories/' },
  },
  {
    name: 'domain-repositories-not-to-utils',
    severity: 'error',
    comment: 'domain/repositories 는 domain/utils 에 의존하지 않습니다 (리포지토리 인터페이스는 얇게 유지).',
    from: { path: '^src/domain/repositories' },
    to: { path: '^src/domain/utils/' },
  },

  /* ---------- CQRS / 포트 ---------- */
  {
    name: 'no-cqrs-command-handlers-to-query-handlers',
    severity: 'error',
    comment: 'command handlers 는 query handlers 를 import 하지 않습니다.',
    from: { path: '^src/application/commands/handlers/' },
    to: { path: '^src/application/queries/handlers/' },
  },
  {
    name: 'no-cqrs-query-handlers-to-command-handlers',
    severity: 'error',
    comment: 'query handlers 는 command handlers 를 import 하지 않습니다.',
    from: { path: '^src/application/queries/handlers/' },
    to: { path: '^src/application/commands/handlers/' },
  },
  {
    name: 'ports-not-to-handlers',
    severity: 'error',
    comment: 'port 인터페이스는 구체 핸들러 클래스를 import 하지 않습니다.',
    from: { path: '^src/application/((commands|queries)/)?ports/' },
    to: { path: '^src/application/(commands|queries)/handlers/' },
  },
  {
    name: 'command-handlers-not-to-query-strategies',
    severity: 'error',
    comment: 'command handlers 는 MFA 등 query strategies 에 직접 의존하지 않습니다.',
    from: { path: '^src/application/commands/handlers/' },
    to: { path: '^src/application/queries/strategies/' },
  },
  {
    name: 'query-strategies-not-to-command-handlers',
    severity: 'error',
    comment: 'query strategies 는 command handlers 에 의존하지 않습니다.',
    from: { path: '^src/application/queries/strategies/' },
    to: { path: '^src/application/commands/handlers/' },
  },

  /* ---------- 프레임워크 / 얇은 presentation ---------- */
  {
    name: 'application-not-to-mikro-orm',
    severity: 'error',
    comment: 'application 레이어는 MikroORM 에 직접 의존하지 않습니다 (영속성은 infrastructure).',
    from: {
      path: '^src/application',
      pathNot: 'application\\.module\\.ts$',
    },
    to: {
      path: 'node_modules/@mikro-orm/',
    },
  },
  {
    name: 'presentation-dto-not-to-infrastructure',
    severity: 'error',
    comment: 'presentation/dto 는 infrastructure 에 의존하지 않습니다.',
    from: { path: '^src/presentation/dto/' },
    to: { path: '^src/infrastructure/' },
  },
  {
    name: 'presentation-dto-not-to-handlers',
    severity: 'error',
    comment: 'presentation/dto 는 application 핸들러에 직접 의존하지 않습니다 (포트·DTO만 사용).',
    from: { path: '^src/presentation/dto/' },
    to: { path: '^src/application/(commands|queries)/handlers/' },
  },

  /* ---------- 그래프 품질 ---------- */
  {
    name: 'no-circular-dependencies',
    severity: 'warn',
    comment:
      'src 하위 순환을 감지합니다. MikroORM 엔티티(양방향 관계)·*.module.ts(Nest imports) 에서 나는 순환은 제외합니다.',
    from: {
      path: '^src/',
      pathNot: '(mikro-orm/entities/|\\.module\\.ts$)',
    },
    to: { circular: true },
  },
];

const options = {
  doNotFollow: {
    path: 'node_modules',
  },
  tsConfig: {
    fileName: 'tsconfig.json',
  },
  enhancedResolveOptions: {
    exportsFields: ['exports', 'main'],
    conditionNames: ['import', 'require', 'node', 'default'],
  },
  reporterOptions: {
    dot: {
      theme: {
        graph: { bgcolor: 'white' },
      },
    },
  },
};

/** dependency-cruiser 가 허용하는 키만 export (그 외 키는 스키마 검증 실패). */
module.exports = {
  forbidden,
  options,
};
