export async function parseSitemap(baseUrl: string): Promise<string[]> {
  const urls: string[] = [];

  // Try common sitemap locations
  const sitemapLocations = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/sitemap/sitemap.xml`,
    `${baseUrl}/sitemaps/sitemap.xml`,
  ];

  for (const sitemapUrl of sitemapLocations) {
    try {
      const response = await fetch(sitemapUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; crawl-op/1.0)',
        },
      });

      if (response.ok) {
        const content = await response.text();
        const parsed = parseSitemapContent(content, baseUrl);
        urls.push(...parsed);
        break; // Found a valid sitemap
      }
    } catch {
      // Try next location
    }
  }

  // Deduplicate
  return [...new Set(urls)];
}

function parseSitemapContent(content: string, baseUrl: string): string[] {
  const urls: string[] = [];

  // Simple XML parsing using regex (avoids XML parser dependency)
  // Match <loc> tags
  const locMatches = content.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi);
  for (const match of locMatches) {
    const url = match[1].trim();
    if (url) {
      // Handle CDATA
      const cleanUrl = url
        .replace(/<!\[CDATA\[/, '')
        .replace(/\]\]>/, '')
        .trim();
      urls.push(cleanUrl);
    }
  }

  // Check for sitemap index (nested sitemaps)
  const sitemapMatches = content.matchAll(/<sitemap>[\s\S]*?<loc>\s*([^<]+)\s*<\/loc>[\s\S]*?<\/sitemap>/gi);
  for (const match of sitemapMatches) {
    const sitemapUrl = match[1].trim();
    // We could recursively fetch these, but for now just note them
    // To avoid infinite loops and excessive requests
  }

  return urls;
}

// Also check robots.txt for Sitemap directive
export async function findSitemapsFromRobots(baseUrl: string): Promise<string[]> {
  try {
    const response = await fetch(`${baseUrl}/robots.txt`);
    if (!response.ok) return [];

    const content = await response.text();
    const sitemaps: string[] = [];

    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^Sitemap:\s*(.+)$/i);
      if (match) {
        sitemaps.push(match[1].trim());
      }
    }

    return sitemaps;
  } catch {
    return [];
  }
}
