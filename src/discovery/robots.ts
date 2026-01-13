export async function parseRobotsTxt(baseUrl: string): Promise<string[]> {
  const robotsUrl = `${baseUrl}/robots.txt`;

  const response = await fetch(robotsUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; crawl-op/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch robots.txt: ${response.status}`);
  }

  const content = await response.text();
  return parseRobotsContent(content);
}

function parseRobotsContent(content: string): string[] {
  const paths = new Set<string>();
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Parse directives
    const match = trimmed.match(/^(Disallow|Allow|Sitemap):\s*(.+)$/i);
    if (match) {
      const directive = match[1].toLowerCase();
      const value = match[2].trim();

      if (directive === 'disallow' || directive === 'allow') {
        if (value && value !== '/') {
          // Normalize path
          const path = value.startsWith('/') ? value : `/${value}`;
          // Remove wildcards for crawling
          const cleanPath = path.replace(/\*.*$/, '').replace(/\$$/, '');
          if (cleanPath && cleanPath !== '/') {
            paths.add(cleanPath);
          }
        }
      }
    }
  }

  return Array.from(paths).sort();
}
