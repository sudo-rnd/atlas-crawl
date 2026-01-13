#!/usr/bin/env node

import { program } from 'commander';
import { Crawler } from './crawler/engine.js';
import { printBanner, printResults, printError } from './output/terminal.js';
import { generateMarkdownReport } from './output/markdown.js';
import type { CrawlOptions, RatePreset } from './types.js';
import fs from 'fs/promises';

const VERSION = '1.0.0';

program
  .name('atlas-crawl')
  .description('Atlas Crawl - Web reconnaissance & security scanner')
  .version(VERSION)
  .argument('<url>', 'Target URL to crawl')
  .option('-d, --depth <number>', 'Maximum crawl depth', '2')
  .option('-o, --output <file>', 'Save markdown report to file')
  .option('--subdomains <wordlist>', 'Wordlist file for subdomain bruteforce')
  .option('--save-js', 'Save and pretty print JavaScript files', false)
  .option('-c, --cookies <cookies>', 'Cookies to inject (key=val;key2=val2)')
  .option('-H, --headers <header>', 'Custom headers (can be used multiple times)', collect, [])
  .option('-r, --rate <preset>', 'Rate limit preset: stealth, normal, aggressive', 'normal')
  .option('--timeout <ms>', 'Page load timeout in milliseconds', '30000')
  .option('--scope <regex>', 'Only crawl URLs matching this regex')
  .option('--exclude <patterns>', 'Exclude URL patterns (comma-separated)')
  .option('--no-cache', 'Bypass Service Workers and browser cache', false)
  .action(async (url: string, opts) => {
    try {
      // Validate URL
      const targetUrl = normalizeUrl(url);

      // Parse options
      const options: CrawlOptions = {
        depth: parseInt(opts.depth, 10),
        output: opts.output,
        subdomains: opts.subdomains,
        saveJs: opts.saveJs,
        cookies: opts.cookies,
        headers: opts.headers,
        rate: validateRate(opts.rate),
        timeout: parseInt(opts.timeout, 10),
        scope: opts.scope,
        exclude: opts.exclude?.split(',').map((p: string) => p.trim()),
        noCache: opts.cache === false, // --no-cache sets opts.cache to false
      };

      // Print banner
      printBanner(VERSION, targetUrl, options);

      // Create and run crawler
      const crawler = new Crawler(targetUrl, options);
      const results = await crawler.run();

      // Print results to terminal
      printResults(results);

      // Save markdown report if requested
      if (options.output) {
        const report = generateMarkdownReport(results);
        await fs.writeFile(options.output, report, 'utf-8');
        console.log(`\n Report saved to: ${options.output}`);
      }

    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Helper to collect multiple header flags
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

// Normalize URL (add https if missing)
function normalizeUrl(url: string): string {
  if (!/^https?:\/\//i.test(url)) {
    return `https://${url}`;
  }
  return url;
}

// Validate rate preset
function validateRate(rate: string): RatePreset {
  const valid: RatePreset[] = ['stealth', 'normal', 'aggressive'];
  if (!valid.includes(rate as RatePreset)) {
    throw new Error(`Invalid rate preset: ${rate}. Use: ${valid.join(', ')}`);
  }
  return rate as RatePreset;
}

program.parse();
