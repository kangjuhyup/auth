import { SAFE_SYSTEM_TAGS } from './system-tags.js';

export function classifyLoginResponse(status) {
  if (status === 401) return 'auth-rejected';
  if (status === 429) return 'rate-limited';
  return 'unexpected';
}

export function createRateLimitOptions() {
  return {
    systemTags: [...SAFE_SYSTEM_TAGS],
    vus: 1,
    iterations: 15,
    thresholds: {
      security_rate_limited_total: ['count>0'],
      security_unexpected_total: ['count==0'],
    },
  };
}
