# @pipeworx/brave-search

Brave Search MCP — independent web index with AI-friendly licensing.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

- `web_search(q, count?, offset?, country?, search_lang?, safesearch?, freshness?)`
- `news_search(q, count?, offset?, country?, search_lang?, freshness?)`

## Auth

- **Platform key:** gateway env `PLATFORM_BRAVE_KEY`.
- **BYO:** `?_apiKey=<key>` after registering at https://brave.com/search/api/ (free 2k/mo, 1 req/sec).

## Data source

`https://api.search.brave.com/res/v1/` — header `X-Subscription-Token`.

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "brave-search": {
      "url": "https://gateway.pipeworx.io/brave-search/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Brave Search data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
