// CLI Options
export interface CrawlOptions {
  depth: number;
  output?: string;
  subdomains?: string;
  saveJs: boolean;
  cookies?: string;
  headers: string[];
  rate: RatePreset;
  timeout: number;
  scope?: string;
  exclude?: string[];
  noCache: boolean; // Bypass Service Workers and browser cache
}

export type RatePreset = 'stealth' | 'normal' | 'aggressive';

export interface RateLimitConfig {
  delay: number;       // ms between requests
  concurrency: number; // max concurrent pages
}

// Crawl Results
export interface CrawlResult {
  target: string;
  startTime: Date;
  endTime?: Date;
  pages: PageResult[];
  endpoints: ApiEndpoint[];
  forms: FormInfo[];
  jsFiles: JsFileResult[];
  secrets: SecretMatch[];
  subdomains: SubdomainResult[];
  robotsPaths: string[];
  sitemapUrls: string[];
  errors: CrawlError[];
}

export interface PageResult {
  url: string;
  statusCode: number;
  title?: string;
  depth: number;
  links: LinkInfo[];
  contentType?: string;
}

export interface LinkInfo {
  url: string;
  text?: string;
  type: 'internal' | 'external';
  tagName: string; // a, link, script, img, etc.
}

export interface ApiEndpoint {
  url: string;
  method: string;
  contentType?: string;
  source: 'network' | 'js-analysis';
  foundOn?: string; // page where it was discovered
}

export interface FormInfo {
  url: string;        // page URL where form was found
  action: string;
  method: string;
  fields: FormField[];
  formType: 'login' | 'search' | 'upload' | 'contact' | 'other';
}

export interface FormField {
  name: string;
  type: string;
  required: boolean;
  placeholder?: string;
}

export interface JsFileResult {
  url: string;
  size: number;
  endpoints: string[];
  secrets: SecretMatch[];
  savedPath?: string; // if --save-js was used
}

export interface SecretMatch {
  type: SecretType;
  value: string;
  masked: string;     // partially hidden for display
  file: string;
  line?: number;
}

export type SecretType =
  | 'aws-key'
  | 'google-api'
  | 'jwt'
  | 'bearer-token'
  | 'private-key'
  | 'api-key'
  | 's3-bucket'
  | 'internal-url'
  | 'password'
  | 'generic-secret';

export interface SubdomainResult {
  subdomain: string;
  ip?: string;
  alive: boolean;
}

export interface CrawlError {
  url: string;
  error: string;
  timestamp: Date;
}

// Secret Pattern Config
export interface SecretPattern {
  type: SecretType;
  name: string;
  pattern: RegExp;
  mask: (value: string) => string;
}

// Crawler internal state
export interface CrawlerState {
  visited: Set<string>;
  queue: QueueItem[];
  results: CrawlResult;
}

export interface QueueItem {
  url: string;
  depth: number;
  parentUrl?: string;
}
