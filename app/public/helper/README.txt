THE ANCHOR TAB · MCP BRIDGE (helper)

anchor-mcp-server.mjs is a zero-dependency Node 18+ bridge. It connects an
MCP client to the open Anchor Tab page. Keep the page open while you use it.

SESSIONS
  Claude        stdio   port 7777
  Gemini CLI    stdio   port 7778
  ChatGPT web   http    port 7779  (exposed through an HTTPS tunnel)
  Generic MCP   stdio   port 7780

Choose a session in Settings > AI connection. Each one has its own port,
secret token and permissions. Copy the config or commands from that card.

STDIO (Claude, Gemini CLI, generic MCP)
  The generated config runs:
    node /path/to/anchor-mcp-server.mjs
  with these environment variables:
    ANCHOR_TOKEN      secret from the session card
    ANCHOR_PORT       session port, e.g. 7777
    ANCHOR_CLIENT     claude | gemini | chatgpt | generic
  Paste the config into the client's MCP settings, then restart the client.

HTTP (ChatGPT web)
  1. Start the bridge in PowerShell:
       $env:ANCHOR_CLIENT="chatgpt"
       $env:ANCHOR_TRANSPORT="http"
       $env:ANCHOR_PORT="7779"
       $env:ANCHOR_TOKEN="<token from the ChatGPT card>"
       node C:\path\to\anchor-mcp-server.mjs

  2. Expose it with any HTTPS tunnel, for example:
       cloudflared tunnel --url http://127.0.0.1:7779
     Copy the public hostname it prints, e.g. https://demo.trycloudflare.com

  3. Paste that hostname into "Public tunnel URL" in the ChatGPT card.
     In ChatGPT, add a custom connector with the generated URL:
       https://demo.trycloudflare.com/t/<token>/mcp
     Choose "No authentication" because the token is already in the path.

HEALTH CHECK
  The helper listens only on 127.0.0.1. With a token:
    curl -H "x-anchor-token: <token>" http://127.0.0.1:7779/health
  It returns the client name, transport, connection state and version.

TOKENS
  Accepted forms:
    Authorization: Bearer <token>
    x-anchor-token: <token>
    ?token=<token>
    /t/<token>/mcp
  A helper rejects any other token. Use "New token" in the session card to
  rotate one; update that client's config afterwards.

SECURITY
  - Only enable the sessions and scopes you need.
  - A tunnel URL is a public secret. Anyone with it can reach that session
    while the tunnel and bridge are running. Stop the tunnel when finished.
  - The page must be open and "Allow AI to connect" must be on.
