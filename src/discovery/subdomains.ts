import dns from 'dns/promises';
import fs from 'fs/promises';
import type { SubdomainResult } from '../types.js';

const MAX_CONCURRENT = 50;
const DNS_TIMEOUT = 5000;

export async function discoverSubdomains(
  domain: string,
  wordlistPath: string
): Promise<SubdomainResult[]> {
  // Read wordlist
  const content = await fs.readFile(wordlistPath, 'utf-8');
  const words = content
    .split('\n')
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w && !w.startsWith('#'));

  // Remove duplicates
  const uniqueWords = [...new Set(words)];

  // Process in batches
  const results: SubdomainResult[] = [];

  for (let i = 0; i < uniqueWords.length; i += MAX_CONCURRENT) {
    const batch = uniqueWords.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.all(
      batch.map((word) => checkSubdomain(word, domain))
    );
    results.push(...batchResults);
  }

  return results;
}

async function checkSubdomain(
  prefix: string,
  domain: string
): Promise<SubdomainResult> {
  const subdomain = `${prefix}.${domain}`;

  try {
    // Set custom timeout using AbortController
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DNS_TIMEOUT);

    try {
      const addresses = await dns.resolve4(subdomain);

      clearTimeout(timeout);

      if (addresses && addresses.length > 0) {
        // Verify it's actually alive with an HTTP request
        const alive = await isSubdomainAlive(subdomain);

        return {
          subdomain,
          ip: addresses[0],
          alive,
        };
      }
    } catch (err: unknown) {
      clearTimeout(timeout);
      // DNS resolution failed
    }
  } catch {
    // Lookup failed
  }

  return {
    subdomain,
    alive: false,
  };
}

async function isSubdomainAlive(subdomain: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`https://${subdomain}`, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'manual', // Don't follow redirects
    });

    clearTimeout(timeout);

    // Consider it alive if we get any response
    return response.status > 0;
  } catch {
    // Try HTTP if HTTPS fails
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`http://${subdomain}`, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'manual',
      });

      clearTimeout(timeout);
      return response.status > 0;
    } catch {
      return false;
    }
  }
}

// Common subdomain prefixes for quick testing
export const COMMON_SUBDOMAINS = [
  'www',
  'mail',
  'ftp',
  'admin',
  'api',
  'dev',
  'staging',
  'test',
  'beta',
  'demo',
  'app',
  'blog',
  'shop',
  'store',
  'cdn',
  'static',
  'assets',
  'images',
  'img',
  'media',
  'portal',
  'secure',
  'login',
  'auth',
  'sso',
  'vpn',
  'remote',
  'internal',
  'intranet',
  'extranet',
  'git',
  'gitlab',
  'github',
  'jenkins',
  'ci',
  'build',
  'deploy',
  'docker',
  'k8s',
  'kubernetes',
  'monitoring',
  'grafana',
  'prometheus',
  'elastic',
  'kibana',
  'logs',
  'status',
  'health',
  'docs',
  'wiki',
  'support',
  'help',
  'forum',
  'community',
  'news',
  'cms',
  'crm',
  'erp',
  'hr',
  'sales',
  'marketing',
  'analytics',
  'tracking',
  'ws',
  'websocket',
  'socket',
  'realtime',
  'push',
  'notify',
  'smtp',
  'pop',
  'imap',
  'mx',
  'ns1',
  'ns2',
  'dns',
  'proxy',
  'gateway',
  'edge',
  'node',
  'server',
  'host',
  'backup',
  'db',
  'database',
  'mysql',
  'postgres',
  'mongo',
  'redis',
  'cache',
  'queue',
  'mq',
  'rabbit',
  's3',
  'storage',
  'files',
  'upload',
  'download',
];
