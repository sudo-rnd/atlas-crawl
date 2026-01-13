import { SECRET_PATTERNS, ENDPOINT_PATTERNS } from '../config/patterns.js';
import type { JsFileResult, SecretMatch } from '../types.js';
import fs from 'fs/promises';
import path from 'path';
import * as prettier from 'prettier';

export async function analyzeJsFile(
  url: string,
  saveFile: boolean = false
): Promise<JsFileResult> {
  // Fetch the JS file
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const content = await response.text();
  const size = content.length;

  // Find secrets
  const secrets = findSecrets(content, url);

  // Find API endpoints
  const endpoints = findEndpoints(content);

  // Save file if requested
  let savedPath: string | undefined;
  if (saveFile) {
    savedPath = await saveJsFile(url, content);
  }

  return {
    url,
    size,
    endpoints,
    secrets,
    savedPath,
  };
}

function findSecrets(content: string, fileUrl: string): SecretMatch[] {
  const secrets: SecretMatch[] = [];
  const seen = new Set<string>();

  // Split content into lines for line number tracking
  const lines = content.split('\n');

  for (const pattern of SECRET_PATTERNS) {
    // Reset regex state
    pattern.pattern.lastIndex = 0;

    let match;
    while ((match = pattern.pattern.exec(content)) !== null) {
      const value = match[1] || match[0];

      // Skip duplicates
      const key = `${pattern.type}:${value}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Skip common false positives
      if (isFalsePositive(value, pattern.type)) continue;

      // Find line number
      const lineNumber = findLineNumber(lines, match.index);

      secrets.push({
        type: pattern.type,
        value,
        masked: pattern.mask(value),
        file: fileUrl,
        line: lineNumber,
      });
    }
  }

  return secrets;
}

function findEndpoints(content: string): string[] {
  const endpoints = new Set<string>();

  for (const pattern of ENDPOINT_PATTERNS) {
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      const endpoint = match[1];

      // Skip obvious non-endpoints
      if (!endpoint ||
        endpoint.length < 3 ||
        endpoint.includes('{{') ||
        endpoint.includes('${') ||
        endpoint.startsWith('data:') ||
        endpoint.startsWith('javascript:')) {
        continue;
      }

      // Normalize and add
      endpoints.add(endpoint);
    }
  }

  return Array.from(endpoints);
}

function findLineNumber(lines: string[], charIndex: number): number {
  let currentIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    currentIndex += lines[i].length + 1; // +1 for newline
    if (currentIndex > charIndex) {
      return i + 1; // 1-indexed
    }
  }
  return lines.length;
}

function isFalsePositive(value: string, type: string): boolean {
  // Skip placeholder values
  const placeholders = [
    'your-api-key',
    'your_api_key',
    'xxx',
    'yyy',
    'zzz',
    'example',
    'test',
    'demo',
    'sample',
    'placeholder',
    'insert',
    'replace',
  ];

  const lowerValue = value.toLowerCase();
  if (placeholders.some((p) => lowerValue.includes(p))) {
    return true;
  }

  // Skip too-short values (except for specific patterns)
  if (value.length < 10 && type !== 's3-bucket') {
    return true;
  }

  // Skip values that look like CSS or common patterns
  if (value.match(/^[a-f0-9]{6}$/i)) return true; // hex color
  if (value.match(/^#[a-f0-9]{3,8}$/i)) return true; // hex color with #

  // Skip common library/framework tokens
  const commonTokens = [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // Common JWT header
  ];
  if (commonTokens.includes(value)) return true;

  return false;
}

async function saveJsFile(url: string, content: string): Promise<string> {
  // Create js-files directory
  const outputDir = path.join(process.cwd(), 'crawl-output', 'js-files');
  await fs.mkdir(outputDir, { recursive: true });

  // Generate filename from URL
  const urlObj = new URL(url);
  const filename = urlObj.pathname.replace(/\//g, '_').replace(/^_/, '') || 'index.js';
  const outputPath = path.join(outputDir, filename);

  // Pretty print the JS
  let prettyContent: string;
  try {
    prettyContent = await prettier.format(content, {
      parser: 'babel',
      printWidth: 100,
      tabWidth: 2,
      semi: true,
      singleQuote: true,
    });
  } catch {
    // If prettier fails, save as-is
    prettyContent = content;
  }

  // Add header comment
  const header = `/**
 * Source: ${url}
 * Saved by crawl-op
 * Date: ${new Date().toISOString()}
 */

`;

  await fs.writeFile(outputPath, header + prettyContent, 'utf-8');

  return outputPath;
}
