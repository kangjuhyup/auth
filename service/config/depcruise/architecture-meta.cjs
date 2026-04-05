/** Jest 등에서 규칙 이름만 쓸 때 — dependency-cruiser 설정 스키마에 포함되지 않음 */
const { forbidden } = require('./architecture.cjs');

module.exports = {
  knownRuleNames: forbidden.map((r) => r.name),
  enforcedRuleNames: forbidden.filter((r) => r.severity === 'error').map((r) => r.name),
};
