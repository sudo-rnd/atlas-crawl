import type { SecretPattern } from '../types.js';

// Return value as-is (no masking)
const identity = (v: string): string => v;

export const SECRET_PATTERNS: SecretPattern[] = [
  // AWS Access Key
  {
    type: 'aws-key',
    name: 'AWS Access Key',
    pattern: /\b(AKIA[0-9A-Z]{16})\b/g,
    mask: identity,
  },
  // AWS Secret Key
  {
    type: 'aws-key',
    name: 'AWS Secret Key',
    pattern: /\b([A-Za-z0-9/+=]{40})\b/g,
    mask: identity,
  },
  // Google API Key
  {
    type: 'google-api',
    name: 'Google API Key',
    pattern: /\b(AIza[0-9A-Za-z\-_]{35})\b/g,
    mask: identity,
  },
  // JWT Token
  {
    type: 'jwt',
    name: 'JWT Token',
    pattern: /\b(eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+/=]*)\b/g,
    mask: identity,
  },
  // Bearer Token
  {
    type: 'bearer-token',
    name: 'Bearer Token',
    pattern: /['"]?Bearer\s+([A-Za-z0-9\-_\.]+)['"]?/gi,
    mask: identity,
  },
  // Generic API Key patterns
  {
    type: 'api-key',
    name: 'API Key',
    pattern: /['"]?(?:api[_-]?key|apikey|api[_-]?secret|access[_-]?token|auth[_-]?token)['"]?\s*[:=]\s*['"]?([A-Za-z0-9\-_]{20,})['"]?/gi,
    mask: identity,
  },
  // Private Key
  {
    type: 'private-key',
    name: 'Private Key',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    mask: identity,
  },
  // S3 Bucket
  {
    type: 's3-bucket',
    name: 'S3 Bucket',
    pattern: /\b([a-z0-9][a-z0-9\-]{1,61}[a-z0-9]\.s3(?:\.[a-z0-9\-]+)?\.amazonaws\.com)\b/gi,
    mask: (v) => v,
  },
  // S3 Bucket URL style
  {
    type: 's3-bucket',
    name: 'S3 Bucket URL',
    pattern: /\bs3:\/\/([a-z0-9][a-z0-9\-]{1,61}[a-z0-9])\b/gi,
    mask: (v) => v,
  },
  // Slack Token
  {
    type: 'api-key',
    name: 'Slack Token',
    pattern: /\b(xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*)\b/g,
    mask: identity,
  },
  // GitHub Token
  {
    type: 'api-key',
    name: 'GitHub Token',
    pattern: /\b(ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|ghu_[A-Za-z0-9]{36}|ghs_[A-Za-z0-9]{36}|ghr_[A-Za-z0-9]{36})\b/g,
    mask: identity,
  },
  // Stripe Key
  {
    type: 'api-key',
    name: 'Stripe Key',
    pattern: /\b(sk_live_[A-Za-z0-9]{24,}|pk_live_[A-Za-z0-9]{24,})\b/g,
    mask: identity,
  },
  // Password in URL
  {
    type: 'password',
    name: 'Password in URL',
    pattern: /:\/\/[^:]+:([^@]+)@/g,
    mask: identity,
  },
  // Generic Password Assignment
  {
    type: 'password',
    name: 'Password',
    pattern: /['"]?(?:password|passwd|pwd|secret)['"]?\s*[:=]\s*['"]([^'"]{8,})['"]?/gi,
    mask: identity,
  },
  // Email addresses
  {
    type: 'email',
    name: 'Email',
    pattern: /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/g,
    mask: identity,
  },
  // Internal URLs (common patterns)
  {
    type: 'internal-url',
    name: 'Internal URL',
    pattern: /https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)(?::\d+)?[^\s'"<>]*/gi,
    mask: (v) => v,
  },
  // Heroku API Key
  {
    type: 'api-key',
    name: 'Heroku API Key',
    pattern: /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/gi,
    mask: identity,
  },
  // Firebase URL
  {
    type: 'internal-url',
    name: 'Firebase URL',
    pattern: /\b(https:\/\/[a-z0-9-]+\.firebaseio\.com)\b/gi,
    mask: (v) => v,
  },
];

// Patterns to extract API endpoints from JS files
export const ENDPOINT_PATTERNS: RegExp[] = [
  // Fetch/axios calls
  /(?:fetch|axios\.(?:get|post|put|patch|delete)|\.(?:get|post|put|patch|delete))\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  // URL assignments
  /(?:url|endpoint|api|path|href)\s*[:=]\s*['"`]([^'"`]*\/[^'"`]+)['"`]/gi,
  // Template literals with paths
  /['"`](\/api\/[^'"`]+)['"`]/gi,
  /['"`](\/v\d+\/[^'"`]+)['"`]/gi,
  // REST-style paths
  /['"`](\/[a-z]+(?:\/[a-z]+)+)['"`]/gi,
];

// File extensions to ignore when looking for secrets
export const IGNORED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.webm', '.ogg', '.wav',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.zip', '.tar', '.gz', '.rar',
];
