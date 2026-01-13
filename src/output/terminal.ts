import chalk from 'chalk';
import type { CrawlOptions, CrawlResult, FormInfo } from '../types.js';
import { deduplicateEndpoints } from '../extractors/endpoints.js';

const DIVIDER = '━'.repeat(60);

const ASCII_BANNER = `
        _   _           ___                  _
  __ _ | |_| | __ _ ___/ __|_ _ __ ___ __ __| |
 / _\` ||  _| |/ _\` (_-< (__| '_/ _\` \\ V  V /| |
 \\__,_| \\__|_|\\__,_/__/\\___|_| \\__,_|\\_/\\_/ |_|
`;

export function printBanner(version: string, target: string, options: CrawlOptions): void {
  console.log(chalk.green(ASCII_BANNER));
  console.log(chalk.gray(`  [ v${version} ] Web Reconnaissance & Security Scanner`));
  console.log();
  console.log(chalk.gray('  target  : ') + chalk.green(target));
  console.log(chalk.gray('  mode    : ') + chalk.white(options.rate) + chalk.gray('  |  depth: ') + chalk.white(String(options.depth)) + chalk.gray('  |  subs: ') + (options.subdomains ? chalk.green('on') : chalk.gray('off')));
  console.log();
  console.log(chalk.gray(DIVIDER));
  console.log();
}

export function printSection(title: string): void {
  console.log();
  console.log(chalk.green(`[*] ${title}`));
}

export function printProgress(message: string): void {
  console.log(chalk.gray('  ' + message));
}

export function printError(message: string): void {
  console.log();
  console.log(chalk.red.bold('✗ Error: ') + chalk.red(message));
}

export function printResults(results: CrawlResult): void {
  console.log();
  console.log(chalk.gray(DIVIDER));

  // Pages Crawled
  printSection('PAGES CRAWLED');
  if (results.pages.length === 0) {
    console.log(chalk.gray('  No pages crawled'));
  } else {
    const maxPages = 20;
    const pages = results.pages.slice(0, maxPages);
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const prefix = i === pages.length - 1 && results.pages.length <= maxPages ? '└── ' : '├── ';
      const statusColor = page.statusCode >= 400 ? chalk.red : page.statusCode >= 300 ? chalk.yellow : chalk.green;
      console.log(
        chalk.gray('  ' + prefix) +
        chalk.white(truncateUrl(page.url, 50)) +
        chalk.gray(' (') + statusColor(String(page.statusCode)) + chalk.gray(')')
      );
    }
    if (results.pages.length > maxPages) {
      console.log(chalk.gray(`  └── ... and ${results.pages.length - maxPages} more`));
    }
  }

  // API Endpoints
  const endpoints = deduplicateEndpoints(results.endpoints);
  printSection('API ENDPOINTS DISCOVERED');
  if (endpoints.length === 0) {
    console.log(chalk.gray('  No API endpoints found'));
  } else {
    const maxEndpoints = 25;
    const sorted = endpoints.slice(0, maxEndpoints);
    for (let i = 0; i < sorted.length; i++) {
      const ep = sorted[i];
      const prefix = i === sorted.length - 1 && endpoints.length <= maxEndpoints ? '└── ' : '├── ';
      const methodColor = getMethodColor(ep.method);
      console.log(
        chalk.gray('  ' + prefix) +
        methodColor(ep.method.padEnd(6)) +
        chalk.white(truncateUrl(ep.url, 50))
      );
    }
    if (endpoints.length > maxEndpoints) {
      console.log(chalk.gray(`  └── ... and ${endpoints.length - maxEndpoints} more`));
    }
  }

  // Forms Detected
  printSection('FORMS DETECTED');
  if (results.forms.length === 0) {
    console.log(chalk.gray('  No forms found'));
  } else {
    for (let i = 0; i < results.forms.length; i++) {
      const form = results.forms[i];
      const prefix = i === results.forms.length - 1 ? '└── ' : '├── ';
      const formTypeIcon = getFormTypeIcon(form.formType);
      console.log(
        chalk.gray('  ' + prefix) +
        formTypeIcon + ' ' +
        chalk.white(truncateUrl(form.action, 40)) +
        chalk.gray(' [') + chalk.yellow(form.method) + chalk.gray('] - ') +
        chalk.cyan(`${form.fields.length} fields`) +
        chalk.gray(' (') + chalk.magenta(form.formType) + chalk.gray(')')
      );
    }
  }

  // JS Files Analyzed
  printSection('JS FILES ANALYZED');
  if (results.jsFiles.length === 0) {
    console.log(chalk.gray('  No JavaScript files analyzed'));
  } else {
    const maxFiles = 15;
    const files = results.jsFiles.slice(0, maxFiles);
    for (let i = 0; i < files.length; i++) {
      const js = files[i];
      const prefix = i === files.length - 1 && results.jsFiles.length <= maxFiles ? '└── ' : '├── ';
      const sizeStr = formatBytes(js.size);
      console.log(
        chalk.gray('  ' + prefix) +
        chalk.white(truncateUrl(js.url, 45)) +
        chalk.gray(` (${sizeStr})`)
      );
      if (js.endpoints.length > 0) {
        console.log(chalk.gray('  │   └── ') + chalk.cyan(`Endpoints: ${js.endpoints.length} found`));
      }
      if (js.secrets.length > 0) {
        console.log(chalk.gray('  │   └── ') + chalk.red(`Secrets: ${js.secrets.length} found`));
      }
    }
    if (results.jsFiles.length > maxFiles) {
      console.log(chalk.gray(`  └── ... and ${results.jsFiles.length - maxFiles} more`));
    }
  }

  // Secrets Found
  printSection('SECRETS FOUND');
  if (results.secrets.length === 0) {
    console.log(chalk.green('  No secrets detected'));
  } else {
    for (let i = 0; i < results.secrets.length; i++) {
      const secret = results.secrets[i];
      const prefix = i === results.secrets.length - 1 ? '└── ' : '├── ';
      console.log(
        chalk.gray('  ' + prefix) +
        chalk.red.bold(secret.type) + chalk.gray(': ') +
        chalk.yellow(secret.masked) +
        chalk.gray(' in ') +
        chalk.white(getFilename(secret.file)) +
        (secret.line ? chalk.gray(`:${secret.line}`) : '')
      );
    }
  }

  // Subdomains (if discovered)
  if (results.subdomains.length > 0) {
    const alive = results.subdomains.filter((s) => s.alive);
    printSection('SUBDOMAINS');
    if (alive.length === 0) {
      console.log(chalk.gray('  No alive subdomains found'));
    } else {
      for (let i = 0; i < alive.length; i++) {
        const sub = alive[i];
        const prefix = i === alive.length - 1 ? '└── ' : '├── ';
        console.log(
          chalk.gray('  ' + prefix) +
          chalk.green(sub.subdomain) +
          (sub.ip ? chalk.gray(` (${sub.ip})`) : '')
        );
      }
    }
  }

  // Robots.txt paths
  if (results.robotsPaths.length > 0) {
    printSection('ROBOTS.TXT PATHS');
    const maxPaths = 10;
    const paths = results.robotsPaths.slice(0, maxPaths);
    for (let i = 0; i < paths.length; i++) {
      const prefix = i === paths.length - 1 && results.robotsPaths.length <= maxPaths ? '└── ' : '├── ';
      console.log(chalk.gray('  ' + prefix) + chalk.white(paths[i]));
    }
    if (results.robotsPaths.length > maxPaths) {
      console.log(chalk.gray(`  └── ... and ${results.robotsPaths.length - maxPaths} more`));
    }
  }

  // Summary
  console.log();
  console.log(chalk.gray(DIVIDER));
  printSection('SUMMARY');

  const duration = results.endTime
    ? Math.round((results.endTime.getTime() - results.startTime.getTime()) / 1000)
    : 0;

  const summaryItems = [
    { label: 'Pages', value: results.pages.length, color: chalk.white },
    { label: 'API Endpoints', value: endpoints.length, color: chalk.cyan },
    { label: 'Forms', value: results.forms.length, color: chalk.yellow },
    { label: 'JS Files', value: results.jsFiles.length, color: chalk.magenta },
    { label: 'Secrets', value: results.secrets.length, color: results.secrets.length > 0 ? chalk.red : chalk.green },
    { label: 'Errors', value: results.errors.length, color: results.errors.length > 0 ? chalk.red : chalk.green },
    { label: 'Duration', value: `${duration}s`, color: chalk.gray },
  ];

  if (results.subdomains.length > 0) {
    const alive = results.subdomains.filter((s) => s.alive).length;
    summaryItems.splice(5, 0, { label: 'Subdomains', value: `${alive}/${results.subdomains.length}`, color: chalk.green });
  }

  for (let i = 0; i < summaryItems.length; i++) {
    const item = summaryItems[i];
    const prefix = i === summaryItems.length - 1 ? '└── ' : '├── ';
    console.log(
      chalk.gray('  ' + prefix) +
      chalk.white(item.label + ': ') +
      item.color(String(item.value))
    );
  }

  console.log();
  console.log(chalk.gray(DIVIDER));
  console.log();
}

function getMethodColor(method: string): typeof chalk {
  switch (method.toUpperCase()) {
    case 'GET':
      return chalk.green;
    case 'POST':
      return chalk.yellow;
    case 'PUT':
      return chalk.blue;
    case 'PATCH':
      return chalk.cyan;
    case 'DELETE':
      return chalk.red;
    default:
      return chalk.white;
  }
}

function getFormTypeIcon(formType: FormInfo['formType']): string {
  switch (formType) {
    case 'login':
      return chalk.yellow('🔐');
    case 'search':
      return chalk.cyan('🔍');
    case 'upload':
      return chalk.magenta('📁');
    case 'contact':
      return chalk.green('✉️');
    default:
      return chalk.gray('📝');
  }
}

function truncateUrl(url: string, maxLength: number): string {
  if (url.length <= maxLength) return url;
  return url.slice(0, maxLength - 3) + '...';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}b`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}kb`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}mb`;
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
