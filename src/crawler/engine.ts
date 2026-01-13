import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { getRateLimit } from '../config/rate-limits.js';
import { createInterceptor } from './interceptor.js';
import { extractLinks } from '../extractors/links.js';
import { extractForms } from '../extractors/forms.js';
import { analyzeJsFile } from '../extractors/js-analyzer.js';
import { parseRobotsTxt } from '../discovery/robots.js';
import { parseSitemap } from '../discovery/sitemap.js';
import { discoverSubdomains } from '../discovery/subdomains.js';
import { printProgress, printSection } from '../output/terminal.js';
import type {
  CrawlOptions,
  CrawlResult,
  PageResult,
  QueueItem,
  ApiEndpoint,
  JsFileResult,
} from '../types.js';
import fs from 'fs/promises';
import path from 'path';

export class Crawler {
  private targetUrl: URL;
  private options: CrawlOptions;
  private visited: Set<string> = new Set();
  private jsFilesProcessed: Set<string> = new Set();
  private queue: QueueItem[] = [];
  private results: CrawlResult;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  constructor(url: string, options: CrawlOptions) {
    this.targetUrl = new URL(url);
    this.options = options;
    this.results = this.initResults();
  }

  private initResults(): CrawlResult {
    return {
      target: this.targetUrl.href,
      startTime: new Date(),
      pages: [],
      endpoints: [],
      forms: [],
      jsFiles: [],
      secrets: [],
      subdomains: [],
      robotsPaths: [],
      sitemapUrls: [],
      errors: [],
    };
  }

  async run(): Promise<CrawlResult> {
    try {
      // Phase 1: Pre-crawl discovery
      printSection('PRE-CRAWL DISCOVERY');
      await this.preCrawlDiscovery();

      // Phase 2: Subdomain discovery (if wordlist provided)
      if (this.options.subdomains) {
        printSection('SUBDOMAIN DISCOVERY');
        await this.runSubdomainDiscovery();
      }

      // Phase 3: Main crawl
      printSection('CRAWLING');
      await this.startBrowser();
      await this.crawl();

      // Phase 4: JS Analysis
      printSection('JS ANALYSIS');
      await this.analyzeJsFiles();

      this.results.endTime = new Date();
      return this.results;
    } finally {
      await this.cleanup();
    }
  }

  private async preCrawlDiscovery(): Promise<void> {
    const baseUrl = `${this.targetUrl.protocol}//${this.targetUrl.host}`;

    // Fetch robots.txt
    printProgress('Fetching robots.txt...');
    try {
      const robotsPaths = await parseRobotsTxt(baseUrl);
      this.results.robotsPaths = robotsPaths;
      printProgress(`Found ${robotsPaths.length} paths in robots.txt`);

      // Add interesting paths to queue
      for (const p of robotsPaths) {
        this.addToQueue(new URL(p, baseUrl).href, 0);
      }
    } catch {
      printProgress('robots.txt not found or inaccessible');
    }

    // Fetch sitemap
    printProgress('Fetching sitemap.xml...');
    try {
      const sitemapUrls = await parseSitemap(baseUrl);
      this.results.sitemapUrls = sitemapUrls;
      printProgress(`Found ${sitemapUrls.length} URLs in sitemap`);

      // Add sitemap URLs to queue (limited to prevent explosion)
      const maxSitemapUrls = 100;
      for (const url of sitemapUrls.slice(0, maxSitemapUrls)) {
        this.addToQueue(url, 0);
      }
    } catch {
      printProgress('sitemap.xml not found or inaccessible');
    }
  }

  private async runSubdomainDiscovery(): Promise<void> {
    if (!this.options.subdomains) return;

    printProgress('Starting subdomain bruteforce...');
    const domain = this.targetUrl.hostname;
    const results = await discoverSubdomains(domain, this.options.subdomains);
    this.results.subdomains = results;

    const aliveCount = results.filter((r) => r.alive).length;
    printProgress(`Found ${aliveCount} alive subdomains out of ${results.length} checked`);

    // Add alive subdomains to crawl queue
    for (const sub of results.filter((r) => r.alive)) {
      const subUrl = `${this.targetUrl.protocol}//${sub.subdomain}`;
      this.addToQueue(subUrl, 0);
    }
  }

  private async startBrowser(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
    });

    const contextOptions: Parameters<Browser['newContext']>[0] = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    };

    // Parse and inject cookies if provided
    if (this.options.cookies) {
      const cookies = this.parseCookies(this.options.cookies);
      contextOptions.storageState = {
        cookies,
        origins: [],
      };
    }

    // Add custom headers if provided
    if (this.options.headers.length > 0) {
      const headers: Record<string, string> = {};
      for (const h of this.options.headers) {
        const [key, ...rest] = h.split(':');
        headers[key.trim()] = rest.join(':').trim();
      }
      contextOptions.extraHTTPHeaders = headers;
    }

    this.context = await this.browser.newContext(contextOptions);
  }

  private parseCookies(cookieStr: string): Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }> {
    return cookieStr.split(';').map((cookie) => {
      const [name, ...rest] = cookie.trim().split('=');
      return {
        name: name.trim(),
        value: rest.join('=').trim(),
        domain: this.targetUrl.hostname,
        path: '/',
        expires: -1, // Session cookie
        httpOnly: false,
        secure: this.targetUrl.protocol === 'https:',
        sameSite: 'Lax' as const,
      };
    });
  }

  private async crawl(): Promise<void> {
    // Add initial URL
    this.addToQueue(this.targetUrl.href, 0);

    const rateLimit = getRateLimit(this.options.rate);
    const { delay, concurrency } = rateLimit;

    printProgress(`Starting crawl (rate: ${this.options.rate}, depth: ${this.options.depth})`);

    while (this.queue.length > 0) {
      // Process batch of URLs concurrently
      const batch = this.queue.splice(0, concurrency);
      const promises = batch.map((item) => this.crawlPage(item));

      await Promise.allSettled(promises);

      // Apply rate limiting delay
      if (delay > 0 && this.queue.length > 0) {
        await this.sleep(delay);
      }
    }
  }

  private async crawlPage(item: QueueItem): Promise<void> {
    const { url, depth } = item;

    if (this.visited.has(url)) return;
    this.visited.add(url);

    // Check scope
    if (!this.isInScope(url)) return;

    // Check exclusions
    if (this.isExcluded(url)) return;

    printProgress(`[${depth}] ${url}`);

    const page = await this.context!.newPage();

    try {
      // Set up network interception
      const interceptor = createInterceptor(page, this.results);

      // Navigate to page
      const response = await page.goto(url, {
        timeout: this.options.timeout,
        waitUntil: 'networkidle',
      });

      if (!response) {
        this.results.errors.push({
          url,
          error: 'No response received',
          timestamp: new Date(),
        });
        return;
      }

      const statusCode = response.status();
      const contentType = response.headers()['content-type'] || '';

      // Only process HTML pages
      if (!contentType.includes('text/html')) {
        return;
      }

      // Extract page info
      const title = await page.title();
      const links = await extractLinks(page, this.targetUrl.origin);
      const forms = await extractForms(page, url);

      // Create page result
      const pageResult: PageResult = {
        url,
        statusCode,
        title,
        depth,
        links,
        contentType,
      };

      this.results.pages.push(pageResult);
      this.results.forms.push(...forms);

      // Queue new links for crawling
      if (depth < this.options.depth) {
        for (const link of links) {
          if (link.type === 'internal') {
            this.addToQueue(link.url, depth + 1);
          }
        }
      }

      // Collect JS files for later analysis
      for (const link of links) {
        if (link.tagName === 'script' && link.url.endsWith('.js')) {
          if (!this.jsFilesProcessed.has(link.url)) {
            this.jsFilesProcessed.add(link.url);
          }
        }
      }

      // Stop interceptor
      interceptor.stop();
    } catch (error) {
      this.results.errors.push({
        url,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      });
    } finally {
      await page.close();
    }
  }

  private async analyzeJsFiles(): Promise<void> {
    const jsUrls = Array.from(this.jsFilesProcessed);
    printProgress(`Analyzing ${jsUrls.length} JavaScript files...`);

    for (const jsUrl of jsUrls) {
      try {
        const result = await analyzeJsFile(jsUrl, this.options.saveJs);
        this.results.jsFiles.push(result);
        this.results.secrets.push(...result.secrets);

        // Add discovered endpoints
        for (const endpoint of result.endpoints) {
          const apiEndpoint: ApiEndpoint = {
            url: endpoint,
            method: 'GET', // Assume GET for JS-discovered endpoints
            source: 'js-analysis',
            foundOn: jsUrl,
          };
          this.results.endpoints.push(apiEndpoint);
        }

        if (result.secrets.length > 0) {
          printProgress(`  Found ${result.secrets.length} secrets in ${path.basename(jsUrl)}`);
        }
      } catch (error) {
        printProgress(`  Failed to analyze ${jsUrl}: ${error}`);
      }
    }
  }

  private addToQueue(url: string, depth: number): void {
    // Normalize URL
    try {
      const normalized = new URL(url);
      normalized.hash = ''; // Remove fragment
      const cleanUrl = normalized.href;

      if (!this.visited.has(cleanUrl) && !this.queue.some((q) => q.url === cleanUrl)) {
        this.queue.push({ url: cleanUrl, depth });
      }
    } catch {
      // Invalid URL, skip
    }
  }

  private isInScope(url: string): boolean {
    try {
      const parsedUrl = new URL(url);

      // Default: same domain
      if (!this.options.scope) {
        return parsedUrl.hostname === this.targetUrl.hostname ||
          parsedUrl.hostname.endsWith(`.${this.targetUrl.hostname}`);
      }

      // Custom scope regex
      const scopeRegex = new RegExp(this.options.scope);
      return scopeRegex.test(url);
    } catch {
      return false;
    }
  }

  private isExcluded(url: string): boolean {
    if (!this.options.exclude) return false;

    return this.options.exclude.some((pattern) => {
      try {
        const regex = new RegExp(pattern);
        return regex.test(url);
      } catch {
        return url.includes(pattern);
      }
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async cleanup(): Promise<void> {
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }
}
