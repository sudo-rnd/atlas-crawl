import type { ApiEndpoint } from '../types.js';

// Utility to deduplicate and normalize endpoints
export function deduplicateEndpoints(endpoints: ApiEndpoint[]): ApiEndpoint[] {
  const seen = new Map<string, ApiEndpoint>();

  for (const endpoint of endpoints) {
    const key = `${endpoint.method}:${endpoint.url}`;

    if (!seen.has(key)) {
      seen.set(key, endpoint);
    } else {
      // Merge info if we have more details
      const existing = seen.get(key)!;
      if (!existing.contentType && endpoint.contentType) {
        existing.contentType = endpoint.contentType;
      }
    }
  }

  return Array.from(seen.values());
}

// Extract path patterns from endpoints
export function extractPathPatterns(endpoints: ApiEndpoint[]): string[] {
  const patterns = new Set<string>();

  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint.url, 'http://localhost');
      const path = url.pathname;

      // Replace IDs with placeholders
      const normalized = path
        .replace(/\/\d+/g, '/{id}')
        .replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '/{uuid}')
        .replace(/\/[a-f0-9]{24}/g, '/{objectId}');

      patterns.add(normalized);
    } catch {
      patterns.add(endpoint.url);
    }
  }

  return Array.from(patterns).sort();
}

// Group endpoints by base path
export function groupEndpointsByPath(
  endpoints: ApiEndpoint[]
): Map<string, ApiEndpoint[]> {
  const groups = new Map<string, ApiEndpoint[]>();

  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint.url, 'http://localhost');
      const parts = url.pathname.split('/').filter(Boolean);
      const basePath = '/' + (parts[0] || '');

      if (!groups.has(basePath)) {
        groups.set(basePath, []);
      }
      groups.get(basePath)!.push(endpoint);
    } catch {
      const basePath = '/other';
      if (!groups.has(basePath)) {
        groups.set(basePath, []);
      }
      groups.get(basePath)!.push(endpoint);
    }
  }

  return groups;
}
