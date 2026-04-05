import { execSync } from 'node:child_process';
import * as path from 'node:path';

import {
  collectErrorViolations,
  formatViolations,
  groupViolationsByRule,
  type CruiseJson,
  type DepViolation,
} from './depcruise-helpers';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- architecture.cjs 는 스키마상 추가 키 불가
const {
  knownRuleNames,
  enforcedRuleNames,
} = require('../../config/depcruise/architecture-meta.cjs') as {
  knownRuleNames: string[];
  enforcedRuleNames: string[];
};

const serviceRoot = path.resolve(__dirname, '../..');

function cruiseSrcAsJson(): CruiseJson {
  const json = execSync(
    'yarn exec depcruise src --config .dependency-cruiser.cjs --output-type json',
    {
      cwd: serviceRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: process.env,
    },
  );
  return JSON.parse(json) as CruiseJson;
}

describe('architecture: module dependencies (dependency-cruiser)', () => {
  let cruiseResult: CruiseJson;
  let violations: DepViolation[];
  let byRule: Map<string, DepViolation[]>;

  beforeAll(() => {
    cruiseResult = cruiseSrcAsJson();
    violations = collectErrorViolations(cruiseResult);
    byRule = groupViolationsByRule(violations);
  });

  it('설정에 등록된 금지 규칙이 하나 이상 있다', () => {
    expect(knownRuleNames.length).toBeGreaterThan(0);
  });

  it('severity 가 error 인 규칙이 하나 이상 있다', () => {
    expect(enforcedRuleNames.length).toBeGreaterThan(0);
  });

  it('summary.error 가 0 이다 (CLI --output-type err 와 동일 조건)', () => {
    expect(cruiseResult.summary?.error ?? 0).toBe(0);
  });

  it('error 급 위반 목록이 비어 있다', () => {
    if (violations.length > 0) {
      throw new Error(`위반 ${violations.length}건:\n${formatViolations(violations)}`);
    }
  });

  it.each(enforcedRuleNames)('규칙 "%s" (error) 위반 0건', (ruleName) => {
    const list = byRule.get(ruleName) ?? [];
    if (list.length > 0) {
      throw new Error(`${ruleName}:\n${formatViolations(list)}`);
    }
  });

  it('보고된 위반의 규칙 이름은 enforced 목록에만 속한다', () => {
    const unknown = [...byRule.keys()].filter((n) => !enforcedRuleNames.includes(n));
    expect(unknown).toEqual([]);
  });
});
