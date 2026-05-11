interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Brave Search MCP — independent web index (no Google/Bing dependency)
 *
 * Brave runs its own crawler and index. Useful for AI agents because:
 * - independent from the big two (fewer SERP-poisoning surprises)
 * - explicit AI-licensing in the TOS (good for training-data hygiene)
 * - clean structured JSON
 *
 * Free tier: ~2k req/mo, 1 req/sec.
 * API: https://api.search.brave.com
 *
 * Tools:
 * - web_search:  general web results
 * - news_search: recent news with publication metadata
 */


const BASE_URL = 'https://api.search.brave.com/res/v1';

const tools: McpToolExport['tools'] = [
  {
    name: 'web_search',
    description:
      'General web search via the Brave index. Returns title, URL, description snippet, age, language, and site categories. Optional country, language, safesearch, and freshness filters.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Search query' },
        count: { type: 'number', description: 'Results to return (1-20, default 10)' },
        offset: { type: 'number', description: '0-9 page offset (default 0)' },
        country: { type: 'string', description: '2-letter country code (e.g., "us", "gb")' },
        search_lang: { type: 'string', description: '2-letter language (e.g., "en")' },
        safesearch: {
          type: 'string',
          description: 'strict | moderate | off (default moderate)',
          enum: ['strict', 'moderate', 'off'],
        },
        freshness: {
          type: 'string',
          description: 'pd (past day) | pw (past week) | pm (past month) | py (past year) | YYYY-MM-DDtoYYYY-MM-DD',
        },
      },
      required: ['q'],
    },
  },
  {
    name: 'news_search',
    description:
      'News-specific search with publication metadata. Returns title, URL, source, age, snippet, and breaking-news flag.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Search query' },
        count: { type: 'number', description: 'Results (1-20, default 10)' },
        offset: { type: 'number', description: '0-9 page offset' },
        country: { type: 'string', description: '2-letter country code' },
        search_lang: { type: 'string', description: '2-letter language' },
        freshness: { type: 'string', description: 'pd | pw | pm | py' },
      },
      required: ['q'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = (args._apiKey as string | undefined)?.trim();
  if (!apiKey) {
    throw new Error(
      'Brave Search requires an API key. Contact the operator about platform credentials, or BYO via ?_apiKey=<key> after registering at https://brave.com/search/api/ (free 2k/mo).',
    );
  }
  switch (name) {
    case 'web_search':
      return webSearch(apiKey, args);
    case 'news_search':
      return newsSearch(apiKey, args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function commonParams(args: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams({ q: String(args.q) });
  if (args.count != null) params.set('count', String(Math.min(20, Math.max(1, Number(args.count)))));
  if (args.offset != null) params.set('offset', String(Math.min(9, Math.max(0, Number(args.offset)))));
  if (args.country) params.set('country', String(args.country));
  if (args.search_lang) params.set('search_lang', String(args.search_lang));
  if (args.safesearch) params.set('safesearch', String(args.safesearch));
  if (args.freshness) params.set('freshness', String(args.freshness));
  return params;
}

async function braveFetch<T>(apiKey: string, path: string, params: URLSearchParams): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}?${params}`, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey,
    },
  });
  if (res.status === 401 || res.status === 403) throw new Error('Brave Search: unauthorized — check the API key');
  if (res.status === 422) throw new Error('Brave Search: invalid query parameters (HTTP 422)');
  if (res.status === 429) throw new Error('Brave Search: rate-limit hit (free tier 1 req/sec, ~2k/mo)');
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brave Search error: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

interface WebResult {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
  language?: string;
  family_friendly?: boolean;
  type?: string;
  page_age?: string;
  meta_url?: { hostname?: string; favicon?: string };
  thumbnail?: { src?: string };
  profile?: { name?: string };
}

interface NewsResult {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
  page_age?: string;
  breaking?: boolean;
  meta_url?: { hostname?: string };
  thumbnail?: { src?: string };
}

async function webSearch(apiKey: string, args: Record<string, unknown>) {
  const params = commonParams(args);
  const data = await braveFetch<{
    web?: { results?: WebResult[]; total?: number };
    query?: { original?: string; altered?: string };
  }>(apiKey, '/web/search', params);

  return {
    query: data.query?.original ?? args.q,
    altered: data.query?.altered ?? null,
    total: data.web?.total ?? null,
    returned: data.web?.results?.length ?? 0,
    results: (data.web?.results ?? []).map((r) => ({
      title: r.title ?? null,
      url: r.url ?? null,
      description: r.description ?? null,
      age: r.age ?? null,
      page_age: r.page_age ?? null,
      language: r.language ?? null,
      hostname: r.meta_url?.hostname ?? null,
      thumbnail: r.thumbnail?.src ?? null,
    })),
  };
}

async function newsSearch(apiKey: string, args: Record<string, unknown>) {
  const params = commonParams(args);
  const data = await braveFetch<{ results?: NewsResult[] }>(apiKey, '/news/search', params);
  return {
    query: args.q,
    returned: data.results?.length ?? 0,
    results: (data.results ?? []).map((r) => ({
      title: r.title ?? null,
      url: r.url ?? null,
      description: r.description ?? null,
      age: r.age ?? null,
      page_age: r.page_age ?? null,
      breaking: r.breaking ?? null,
      source: r.meta_url?.hostname ?? null,
      thumbnail: r.thumbnail?.src ?? null,
    })),
  };
}

export default { tools, callTool, meter: { credits: 2 } } satisfies McpToolExport;
