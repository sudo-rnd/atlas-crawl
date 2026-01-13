import type { CrawlResult, FormInfo } from '../types.js';
import { deduplicateEndpoints } from '../extractors/endpoints.js';

const DIVIDER = '━'.repeat(60);

const ASCII_BANNER = `
        _   _           ___                  _
  __ _ | |_| | __ _ ___/ __|_ _ __ ___ __ __| |
 / _\` ||  _| |/ _\` (_-< (__| '_/ _\` \\ V  V /| |
 \\__,_| \\__|_|\\__,_/__/\\___|_| \\__,_|\\_/\\_/ |_|
`;

export function generateMarkdownReport(results: CrawlResult): string {
  const lines: string[] = [];

  // Banner
  lines.push(ASCII_BANNER);
  lines.push('  Web Reconnaissance & Security Scanner');
  lines.push('');
  lines.push(`  target   : ${results.target}`);
  lines.push(`  date     : ${results.startTime.toISOString()}`);
  lines.push(`  duration : ${getDuration(results)}s`);
  lines.push('');
  lines.push(DIVIDER);
  lines.push('');

  // Pages Crawled
  lines.push('■ PAGES CRAWLED');
  if (results.pages.length === 0) {
    lines.push('  No pages crawled');
  } else {
    for (let i = 0; i < results.pages.length; i++) {
      const page = results.pages[i];
      const prefix = i === results.pages.length - 1 ? '└── ' : '├── ';
      lines.push(`  ${prefix}${page.url} (${page.statusCode})`);
    }
  }
  lines.push('');

  // API Endpoints
  const endpoints = deduplicateEndpoints(results.endpoints);
  lines.push('■ API ENDPOINTS DISCOVERED');
  if (endpoints.length === 0) {
    lines.push('  No API endpoints found');
  } else {
    for (let i = 0; i < endpoints.length; i++) {
      const ep = endpoints[i];
      const prefix = i === endpoints.length - 1 ? '└── ' : '├── ';
      lines.push(`  ${prefix}${ep.method.padEnd(6)} ${ep.url}`);
    }
  }
  lines.push('');

  // Forms Detected
  lines.push('■ FORMS DETECTED');
  if (results.forms.length === 0) {
    lines.push('  No forms found');
  } else {
    for (let i = 0; i < results.forms.length; i++) {
      const form = results.forms[i];
      const prefix = i === results.forms.length - 1 ? '└── ' : '├── ';
      const icon = getFormTypeIcon(form.formType);
      const fieldNames = form.fields.map(f => f.name).join(', ');
      lines.push(`  ${prefix}${icon} ${form.action} [${form.method}] - ${form.fields.length} fields (${form.formType})`);
      if (form.fields.length > 0) {
        const fieldPrefix = i === results.forms.length - 1 ? '    ' : '│   ';
        lines.push(`  ${fieldPrefix}└── Fields: ${fieldNames}`);
      }
    }
  }
  lines.push('');

  // JS Files Analyzed
  lines.push('■ JS FILES ANALYZED');
  if (results.jsFiles.length === 0) {
    lines.push('  No JavaScript files analyzed');
  } else {
    for (let i = 0; i < results.jsFiles.length; i++) {
      const js = results.jsFiles[i];
      const prefix = i === results.jsFiles.length - 1 ? '└── ' : '├── ';
      const sizeStr = formatBytes(js.size);
      lines.push(`  ${prefix}${js.url} (${sizeStr})`);

      const subPrefix = i === results.jsFiles.length - 1 ? '    ' : '│   ';
      if (js.endpoints.length > 0) {
        lines.push(`  ${subPrefix}├── Endpoints: ${js.endpoints.length} found`);
      }
      if (js.secrets.length > 0) {
        lines.push(`  ${subPrefix}└── Secrets: ${js.secrets.length} found`);
      }
    }
  }
  lines.push('');

  // Secrets Found
  lines.push('■ SECRETS FOUND');
  if (results.secrets.length === 0) {
    lines.push('  No secrets detected');
  } else {
    for (let i = 0; i < results.secrets.length; i++) {
      const secret = results.secrets[i];
      const prefix = i === results.secrets.length - 1 ? '└── ' : '├── ';
      const location = secret.line
        ? `${getFilename(secret.file)}:${secret.line}`
        : getFilename(secret.file);
      lines.push(`  ${prefix}${secret.type}: ${secret.masked} in ${location}`);
    }
  }
  lines.push('');

  // Subdomains (if discovered)
  if (results.subdomains.length > 0) {
    const alive = results.subdomains.filter((s) => s.alive);
    lines.push('■ SUBDOMAINS');
    if (alive.length === 0) {
      lines.push('  No alive subdomains found');
    } else {
      for (let i = 0; i < alive.length; i++) {
        const sub = alive[i];
        const prefix = i === alive.length - 1 ? '└── ' : '├── ';
        const ip = sub.ip ? ` (${sub.ip})` : '';
        lines.push(`  ${prefix}${sub.subdomain}${ip}`);
      }
    }
    lines.push('');
  }

  // Robots.txt paths
  if (results.robotsPaths.length > 0) {
    lines.push('■ ROBOTS.TXT PATHS');
    for (let i = 0; i < results.robotsPaths.length; i++) {
      const prefix = i === results.robotsPaths.length - 1 ? '└── ' : '├── ';
      lines.push(`  ${prefix}${results.robotsPaths[i]}`);
    }
    lines.push('');
  }

  // Sitemap URLs
  if (results.sitemapUrls.length > 0) {
    lines.push('■ SITEMAP URLS');
    for (let i = 0; i < results.sitemapUrls.length; i++) {
      const prefix = i === results.sitemapUrls.length - 1 ? '└── ' : '├── ';
      lines.push(`  ${prefix}${results.sitemapUrls[i]}`);
    }
    lines.push('');
  }

  // Errors
  if (results.errors.length > 0) {
    lines.push('■ ERRORS');
    for (let i = 0; i < results.errors.length; i++) {
      const err = results.errors[i];
      const prefix = i === results.errors.length - 1 ? '└── ' : '├── ';
      lines.push(`  ${prefix}${err.url}`);
      lines.push(`      Error: ${err.error}`);
    }
    lines.push('');
  }

  // Summary
  lines.push(DIVIDER);
  lines.push('');
  lines.push('■ SUMMARY');

  const duration = getDuration(results);
  const summaryItems: Array<{ label: string; value: string | number }> = [
    { label: 'Pages', value: results.pages.length },
    { label: 'API Endpoints', value: endpoints.length },
    { label: 'Forms', value: results.forms.length },
    { label: 'JS Files', value: results.jsFiles.length },
    { label: 'Secrets', value: results.secrets.length },
  ];

  if (results.subdomains.length > 0) {
    const alive = results.subdomains.filter((s) => s.alive).length;
    summaryItems.push({ label: 'Subdomains', value: `${alive}/${results.subdomains.length}` });
  }

  summaryItems.push({ label: 'Errors', value: results.errors.length });
  summaryItems.push({ label: 'Duration', value: `${duration}s` });

  for (let i = 0; i < summaryItems.length; i++) {
    const item = summaryItems[i];
    const prefix = i === summaryItems.length - 1 ? '└── ' : '├── ';
    lines.push(`  ${prefix}${item.label}: ${item.value}`);
  }

  lines.push('');
  lines.push(DIVIDER);
  lines.push('');
  lines.push('Generated by Atlas Crawl');
  lines.push('');

  return lines.join('\n');
}

function getDuration(results: CrawlResult): number {
  if (!results.endTime) return 0;
  return Math.round((results.endTime.getTime() - results.startTime.getTime()) / 1000);
}

function getFilename(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/');
    return parts[parts.length - 1] || parsed.pathname;
  } catch {
    return url;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}b`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}kb`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}mb`;
}

function getFormTypeIcon(formType: FormInfo['formType']): string {
  switch (formType) {
    case 'login': return '[LOGIN]';
    case 'search': return '[SEARCH]';
    case 'upload': return '[UPLOAD]';
    case 'contact': return '[CONTACT]';
    default: return '[FORM]';
  }
}
