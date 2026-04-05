/**
 * dependency-cruiser JSON 출력(summary.violations)에서 error 만 추려 규칙별로 묶습니다.
 * @see https://github.com/sverweij/dependency-cruiser/blob/main/types/cruise-result.d.mts
 */
export type DepViolation = {
  ruleName: string;
  from: string;
  to: string;
  severity: string;
};

export type CruiseJson = {
  summary?: {
    error?: number;
    violations?: Array<{
      from: string;
      to: string;
      rule: { name: string; severity: string };
    }>;
  };
};

export function collectErrorViolations(result: CruiseJson): DepViolation[] {
  const raw = result.summary?.violations ?? [];
  return raw
    .filter((v) => v.rule?.severity === 'error')
    .map((v) => ({
      ruleName: v.rule.name,
      from: v.from,
      to: v.to,
      severity: v.rule.severity,
    }));
}

export function groupViolationsByRule(violations: DepViolation[]): Map<string, DepViolation[]> {
  const map = new Map<string, DepViolation[]>();
  for (const v of violations) {
    const list = map.get(v.ruleName) ?? [];
    list.push(v);
    map.set(v.ruleName, list);
  }
  return map;
}

export function formatViolations(violations: DepViolation[]): string {
  return violations.map((v) => `- **${v.ruleName}**: \`${v.from}\` → \`${v.to}\``).join('\n');
}
