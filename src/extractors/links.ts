import type { Page } from 'playwright';
import type { LinkInfo } from '../types.js';

export async function extractLinks(page: Page, origin: string): Promise<LinkInfo[]> {
  const links: LinkInfo[] = [];
  const seen = new Set<string>();

  // Extract all link-like elements
  const linkData = await page.evaluate(() => {
    const results: Array<{
      url: string;
      text?: string;
      tagName: string;
    }> = [];

    // <a href>
    document.querySelectorAll('a[href]').forEach((el) => {
      const a = el as HTMLAnchorElement;
      results.push({
        url: a.href,
        text: a.textContent?.trim().slice(0, 100),
        tagName: 'a',
      });
    });

    // <link href> (stylesheets, etc.)
    document.querySelectorAll('link[href]').forEach((el) => {
      const link = el as HTMLLinkElement;
      results.push({
        url: link.href,
        tagName: 'link',
      });
    });

    // <script src>
    document.querySelectorAll('script[src]').forEach((el) => {
      const script = el as HTMLScriptElement;
      results.push({
        url: script.src,
        tagName: 'script',
      });
    });

    // <img src>
    document.querySelectorAll('img[src]').forEach((el) => {
      const img = el as HTMLImageElement;
      results.push({
        url: img.src,
        tagName: 'img',
      });
    });

    // <iframe src>
    document.querySelectorAll('iframe[src]').forEach((el) => {
      const iframe = el as HTMLIFrameElement;
      results.push({
        url: iframe.src,
        tagName: 'iframe',
      });
    });

    // <video src> and <source src>
    document.querySelectorAll('video[src], source[src]').forEach((el) => {
      const media = el as HTMLVideoElement | HTMLSourceElement;
      results.push({
        url: media.src,
        tagName: el.tagName.toLowerCase(),
      });
    });

    // <object data>
    document.querySelectorAll('object[data]').forEach((el) => {
      const obj = el as HTMLObjectElement;
      results.push({
        url: obj.data,
        tagName: 'object',
      });
    });

    // <embed src>
    document.querySelectorAll('embed[src]').forEach((el) => {
      const embed = el as HTMLEmbedElement;
      results.push({
        url: embed.src,
        tagName: 'embed',
      });
    });

    // Look for URLs in data attributes
    document.querySelectorAll('[data-url], [data-src], [data-href]').forEach((el) => {
      const dataUrl = el.getAttribute('data-url') ||
        el.getAttribute('data-src') ||
        el.getAttribute('data-href');
      if (dataUrl) {
        results.push({
          url: dataUrl,
          tagName: 'data-attr',
        });
      }
    });

    return results;
  });

  // Process and categorize links
  const originUrl = new URL(origin);

  for (const item of linkData) {
    try {
      // Skip empty, javascript:, mailto:, tel:, etc.
      if (!item.url ||
        item.url.startsWith('javascript:') ||
        item.url.startsWith('mailto:') ||
        item.url.startsWith('tel:') ||
        item.url.startsWith('data:') ||
        item.url === '#') {
        continue;
      }

      // Normalize URL
      const url = new URL(item.url, origin);
      url.hash = ''; // Remove fragment
      const normalizedUrl = url.href;

      // Skip duplicates
      if (seen.has(normalizedUrl)) continue;
      seen.add(normalizedUrl);

      // Determine if internal or external
      const isInternal = url.hostname === originUrl.hostname ||
        url.hostname.endsWith(`.${originUrl.hostname}`);

      links.push({
        url: normalizedUrl,
        text: item.text,
        type: isInternal ? 'internal' : 'external',
        tagName: item.tagName,
      });
    } catch {
      // Invalid URL, skip
    }
  }

  return links;
}
