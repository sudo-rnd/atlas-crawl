import type { RatePreset, RateLimitConfig } from '../types.js';

export const RATE_LIMITS: Record<RatePreset, RateLimitConfig> = {
  stealth: {
    delay: 2000,      // 2 seconds between requests
    concurrency: 1,   // 1 page at a time
  },
  normal: {
    delay: 500,       // 500ms between requests
    concurrency: 3,   // 3 concurrent pages
  },
  aggressive: {
    delay: 0,         // No delay
    concurrency: 10,  // 10 concurrent pages
  },
};

export function getRateLimit(preset: RatePreset): RateLimitConfig {
  return RATE_LIMITS[preset];
}
