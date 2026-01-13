import type { Page, Request, Response } from 'playwright';
import type { CrawlResult, ApiEndpoint } from '../types.js';

interface InterceptorResult {
  stop: () => void;
}

const API_CONTENT_TYPES = [
  'application/json',
  'application/xml',
  'text/xml',
  'application/x-www-form-urlencoded',
];

const IGNORE_EXTENSIONS = [
  '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.webm', '.ogg',
];

export function createInterceptor(page: Page, results: CrawlResult): InterceptorResult {
  const seenEndpoints = new Set<string>();

  const requestHandler = (request: Request) => {
    const url = request.url();
    const method = request.method();

    // Skip static assets
    if (IGNORE_EXTENSIONS.some((ext) => url.toLowerCase().includes(ext))) {
      return;
    }

    // Check if this looks like an API call
    const resourceType = request.resourceType();
    if (resourceType === 'fetch' || resourceType === 'xhr') {
      const key = `${method}:${url}`;
      if (!seenEndpoints.has(key)) {
        seenEndpoints.add(key);

        const endpoint: ApiEndpoint = {
          url: cleanUrl(url),
          method,
          source: 'network',
          foundOn: page.url(),
        };

        results.endpoints.push(endpoint);
      }
    }
  };

  const responseHandler = (response: Response) => {
    const request = response.request();
    const url = request.url();
    const method = request.method();

    // Skip if already processed or static asset
    const key = `${method}:${url}`;
    if (seenEndpoints.has(key)) return;
    if (IGNORE_EXTENSIONS.some((ext) => url.toLowerCase().includes(ext))) return;

    // Check content type for API responses
    const contentType = response.headers()['content-type'] || '';
    const isApiResponse = API_CONTENT_TYPES.some((ct) => contentType.includes(ct));

    if (isApiResponse) {
      seenEndpoints.add(key);

      const endpoint: ApiEndpoint = {
        url: cleanUrl(url),
        method,
        contentType,
        source: 'network',
        foundOn: page.url(),
      };

      results.endpoints.push(endpoint);
    }
  };

  // Attach listeners
  page.on('request', requestHandler);
  page.on('response', responseHandler);

  return {
    stop: () => {
      page.off('request', requestHandler);
      page.off('response', responseHandler);
    },
  };
}

function cleanUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Return path with query params, remove origin for readability
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}
