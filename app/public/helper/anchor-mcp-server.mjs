#!/usr/bin/env node
// The Anchor Tab · MCP bridge. Zero dependencies (Node 18+).
// AI client <-(MCP over stdio or streamable HTTP)-> this server <-(localhost HTTP)-> your open Anchor Tab page.
import http from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";

const VERSION = "2.0.0";
const CLIENTS = ["claude", "gemini", "chatgpt", "generic"];
const DEFAULT_PORTS = { claude: 7777, gemini: 7778, chatgpt: 7779, generic: 7780 };
const CLIENT = CLIENTS.includes(String(process.env.ANCHOR_CLIENT || "").toLowerCase())
  ? String(process.env.ANCHOR_CLIENT).toLowerCase()
  : "claude";
const DEFAULT_TRANSPORT = CLIENT === "chatgpt" ? "http" : "stdio";
const RAW_TRANSPORT = String(process.env.ANCHOR_TRANSPORT || DEFAULT_TRANSPORT).toLowerCase();
const TRANSPORT = ["http", "streamable-http", "streamablehttp"].includes(RAW_TRANSPORT)
  ? "http"
  : "stdio";
const PORT = +process.env.ANCHOR_PORT || DEFAULT_PORTS[CLIENT] || 7777;
const TOKEN = process.env.ANCHOR_TOKEN || "";
const HOST = "127.0.0.1";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`The Anchor Tab MCP bridge ${VERSION}

Environment:
  ANCHOR_TOKEN       Required secret from Settings > AI connection.
  ANCHOR_CLIENT      claude | gemini | chatgpt | generic (default: claude)
  ANCHOR_PORT        Local bridge port (default follows the client)
  ANCHOR_TRANSPORT   stdio | http (default: http for chatgpt, stdio otherwise)

HTTP mode exposes POST /mcp and POST /t/<token>/mcp for tunnel clients.`);
  process.exit(0);
}
if (process.argv.includes("--version") || process.argv.includes("-v")) {
  console.log(VERSION);
  process.exit(0);
}
if (!TOKEN) {
  console.error(
    "Set ANCHOR_TOKEN (copy it from Settings > AI connection). Optional: ANCHOR_CLIENT and ANCHOR_TRANSPORT.",
  );
  process.exit(1);
}

const hdr = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "content-type,x-anchor-token,authorization,mcp-protocol-version,mcp-session-id",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-expose-headers": "mcp-session-id,mcp-protocol-version",
  "cache-control": "no-store",
};

function sameToken(candidate) {
  const value = String(candidate || "");
  if (!value || value.length !== TOKEN.length) return false;
  try {
    return timingSafeEqual(Buffer.from(value), Buffer.from(TOKEN));
  } catch {
    return false;
  }
}

function requestToken(req, url, info) {
  const header = req.headers["x-anchor-token"];
  const direct = Array.isArray(header) ? header[0] : header;
  if (direct) return String(direct);
  const auth = String(req.headers.authorization || "");
  const bearer = /^Bearer\s+(.+)$/i.exec(auth);
  if (bearer) return bearer[1].trim();
  if (info.pathToken) return info.pathToken;
  return String(url.searchParams.get("token") || "");
}

function parseUrl(req) {
  try {
    return new URL(req.url || "/", `http://${HOST}:${PORT}`);
  } catch {
    return new URL(`http://${HOST}:${PORT}/`);
  }
}

function isMcpPath(pathname) {
  if (pathname === "/mcp" || pathname === "/mcp/") return { mcp: true, pathToken: "" };
  const match = /^\/t\/([^/]+)\/mcp\/?$/.exec(pathname);
  if (!match) return { mcp: false, pathToken: "" };
  let pathToken = "";
  try {
    pathToken = decodeURIComponent(match[1]);
  } catch {
    pathToken = match[1];
  }
  return { mcp: true, pathToken };
}

// ---------- bridge to the page (long-poll) ----------
const queue = [];
const waiting = new Map();
let poller = null;
let pageSeen = 0;
const connected = () => Date.now() - pageSeen < 35000;

function dispatch(tool, args) {
  return new Promise((resolve, reject) => {
    if (!connected()) {
      return reject(
        new Error(
          "The Anchor Tab isn't connected. Open the page and switch on Settings > AI connection.",
        ),
      );
    }
    const id = randomUUID();
    const timer = setTimeout(() => {
      waiting.delete(id);
      reject(new Error("Timed out waiting for the page."));
    }, 20000);
    waiting.set(id, { resolve, reject, timer });
    const cmd = { id, tool, args };
    if (poller) {
      const response = poller;
      poller = null;
      response.writeHead(200, hdr).end(JSON.stringify(cmd));
    } else {
      queue.push(cmd);
    }
  });
}

function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    let tooLarge = false;
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      if (tooLarge) return;
      body += chunk;
      if (body.length > limit) {
        tooLarge = true;
        reject(new Error("Request body is too large."));
      }
    });
    req.on("end", () => {
      if (!tooLarge) resolve(body);
    });
    req.on("error", reject);
  });
}

// ---------- MCP protocol ----------
const S = (d, extra = {}) => ({ type: "string", description: d, ...extra });
const N = (d) => ({ type: "number", description: d });
const B = (d) => ({ type: "boolean", description: d });
const obj = (properties, required = []) => ({ type: "object", properties, required });
const TOOLS = [
  [
    "anchor_get_state",
    "Read tasks, parked thoughts, launchpad apps, fields, widgets, Later block layout and appearance. Call this first.",
    obj({}),
  ],
  [
    "anchor_add_task",
    "Add a task to Today's moves, or to the backlog (backlog:true). Use backlog when today's slots are full or it isn't today's focus.",
    obj(
      {
        text: S("Task text, max 100 chars"),
        backlog: B("Put it in the backlog instead of today"),
        project: S("Project name"),
        due: S("YYYY-MM-DD"),
        priority: S("low | medium | high", { enum: ["low", "medium", "high"] }),
        note: S("Short note"),
        start: B("Also set as current task (today only)"),
      },
      ["text"],
    ),
  ],
  [
    "anchor_update_task",
    "Edit, complete, delete or move a task. Identify by index or exact text; set list to backlog for backlog items.",
    obj({
      list: S("today | backlog", { enum: ["today", "backlog"] }),
      index: N("0-based index"),
      match: S("Existing text"),
      text: S("New text"),
      project: S("Project"),
      due: S("YYYY-MM-DD or empty"),
      priority: S("low | medium | high or empty"),
      note: S("Note"),
      done: B("Mark done/undone (today)"),
      move: S("backlog | today", { enum: ["backlog", "today"] }),
      delete: B("Delete it"),
    }),
  ],
  [
    "anchor_park_thought",
    "Park a distracting thought or errand for later.",
    obj({ text: S("The thought") }, ["text"]),
  ],
  ["anchor_set_motto", "Change the north-star motto.", obj({ text: S("Motto") }, ["text"])],
  [
    "anchor_launchpad",
    "Add, update or remove launchpad apps.",
    obj(
      {
        action: S("add | update | remove | replace", {
          enum: ["add", "update", "remove", "replace"],
        }),
        name: S("App name"),
        url: S("https URL"),
        icon: S("One symbol or emoji"),
        tag: S("Short tag"),
        category: S("Single category, e.g. Work"),
        labels: { type: "array", items: { type: "string" }, description: "Reusable labels" },
        guard: B("Start a 10 minute break before opening"),
        apps: {
          type: "array",
          description: "For replace: full list",
          items: obj({
            name: S("name"),
            url: S("url"),
            icon: S("icon"),
            tag: S("tag"),
            category: S("category"),
            labels: { type: "array", items: { type: "string" }, description: "labels" },
            guard: B("break guard"),
          }),
        },
      },
      ["action"],
    ),
  ],
  [
    "anchor_list_fields",
    "List Field Manager fields, their items and the available item types.",
    obj({}),
  ],
  [
    "anchor_field",
    "Create, rename or delete a Field Manager field; add, edit or delete its items.",
    obj(
      {
        action: S("create | rename | delete | add_item | edit_item | delete_item", {
          enum: ["create", "rename", "delete", "add_item", "edit_item", "delete_item"],
        }),
        field: S("Field title or id (not needed for create)"),
        title: S("Field title / item title"),
        help: S("Help text"),
        item: S("Item title or id (edit/delete)"),
        type: S("Item type, see anchor_list_fields"),
        value: {},
        props: { type: "object", description: "Extra item properties, e.g. options" },
        items: {
          type: "array",
          description: "For create: initial items",
          items: obj({ type: S("type"), title: S("title"), help: S("help"), value: {} }),
        },
      },
      ["action"],
    ),
  ],
  [
    "anchor_widget",
    "Add, edit or remove a home-page widget that shows a field.",
    obj(
      {
        action: S("add | edit | remove", { enum: ["add", "edit", "remove"] }),
        field: S("Field title or id"),
        widget: S("Widget index (edit/remove) or field title"),
        items: {
          type: "array",
          items: { type: "string" },
          description: "Item titles to show (omit for all)",
        },
        size: S("s | m | l | xl", { enum: ["s", "m", "l", "xl"] }),
        cols: S("1 | 2", { enum: ["1", "2"] }),
        title: S("Custom title"),
        hideHeader: B("Hide title"),
      },
      ["action"],
    ),
  ],
  [
    "anchor_layout",
    "Resize, hide, restyle or reorder a home-page block. Use later for the merged backlog/thoughts card (backlog and parked are legacy aliases).",
    obj(
      {
        block: S("banner | dates | intent | timer | tasks | later | launchpad | vault | w:<widgetId>"),
        size: S("s | m | l | xl"),
        hidden: B("Hide/show"),
        height: S("auto | sm | md | lg"),
        style: S("card | glass | accent | flat"),
        position: N("0-based position to move to"),
      },
      ["block"],
    ),
  ],
  [
    "anchor_appearance",
    "Change look: theme, accent, background, roundness, font, date mode.",
    obj({
      theme: S("sage | navy | rose | ocean | plum | sunset | forest | mono | night"),
      accent: S("#rrggbb or empty to reset"),
      background: S("plain | glow | aurora | dots"),
      radius: N("4-32"),
      font: S("serif | sans"),
      dateMode: S("both | eth | greg"),
    }),
  ],
].map(([name, description, inputSchema]) => ({ name, description, inputSchema }));

function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id: id === undefined ? null : id, error: { code, message } };
}

async function handleRpc(message) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return rpcError(null, -32600, "Invalid Request");
  }
  const { id, method, params } = message;
  if (typeof method !== "string" || !method) {
    return id === undefined ? null : rpcError(id, -32600, "Invalid Request");
  }
  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: params?.protocolVersion || "2025-03-26",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: `anchor-tab-${CLIENT}`, version: VERSION },
        instructions:
          "Use anchor_get_state first. Changes apply to the open Anchor Tab page. Respect the permissions enabled for this client in Settings > AI connection.",
      },
    };
  }
  if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
  if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  if (method === "tools/call") {
    try {
      const data = await dispatch(params?.name, params?.arguments || {});
      return {
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] },
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        },
      };
    }
  }
  if (method.startsWith("notifications/")) return null;
  if (id === undefined) return null;
  return rpcError(id, -32601, "Method not found");
}

async function handlePayload(payload) {
  if (Array.isArray(payload)) {
    if (!payload.length) return rpcError(null, -32600, "Invalid Request");
    const results = await Promise.all(payload.map((message) => handleRpc(message)));
    const responses = results.filter(Boolean);
    return responses.length ? responses : null;
  }
  return handleRpc(payload);
}

function sendStdio(message) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n");
}

function mcpResponse(req, res, payload) {
  const accept = String(req.headers.accept || "");
  if (accept.includes("text/event-stream")) {
    res.writeHead(200, {
      ...hdr,
      "content-type": "text/event-stream",
      connection: "keep-alive",
    });
    res.end(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
    return;
  }
  res.writeHead(200, hdr).end(JSON.stringify(payload));
}

function jsonError(res, status, message, extra = {}) {
  res
    .writeHead(status, { ...hdr, ...extra })
    .end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32000, message } }));
}

const server = http.createServer((req, res) => {
  const url = parseUrl(req);
  const info = isMcpPath(url.pathname);

  if (req.method === "OPTIONS") {
    res.writeHead(204, hdr).end();
    return;
  }

  if (!sameToken(requestToken(req, url, info))) {
    if (info.mcp) {
      jsonError(res, 401, "Bad or missing Anchor token.", {
        "www-authenticate": 'Bearer realm="anchor-tab"',
      });
    } else {
      res.writeHead(401, hdr).end(JSON.stringify({ error: "bad token" }));
    }
    return;
  }

  const seen = Date.now();
  if (["/ping", "/next", "/result"].includes(url.pathname)) pageSeen = seen;

  if (url.pathname === "/ping" || url.pathname === "/health") {
    res.writeHead(200, hdr).end(
      JSON.stringify({
        ok: true,
        client: CLIENT,
        transport: TRANSPORT,
        connected: connected(),
        version: VERSION,
      }),
    );
    return;
  }

  if (url.pathname === "/next") {
    if (queue.length) {
      res.writeHead(200, hdr).end(JSON.stringify(queue.shift()));
      return;
    }
    if (poller && poller !== res) poller.writeHead(204, hdr).end();
    poller = res;
    res.on("close", () => {
      if (poller === res) poller = null;
    });
    setTimeout(() => {
      if (poller === res) {
        poller = null;
        res.writeHead(204, hdr).end();
      }
    }, 20000);
    return;
  }

  if (url.pathname === "/result" && req.method === "POST") {
    void readBody(req)
      .then((body) => {
        try {
          const result = JSON.parse(body);
          const waiter = waiting.get(result.id);
          if (waiter) {
            clearTimeout(waiter.timer);
            waiting.delete(result.id);
            if (result.ok) waiter.resolve(result.data);
            else waiter.reject(new Error(result.error || "Failed"));
          }
        } catch {
          /* ignore malformed page result */
        }
        res.writeHead(200, hdr).end(JSON.stringify({ ok: true }));
      })
      .catch(() => res.writeHead(200, hdr).end(JSON.stringify({ ok: true })));
    return;
  }

  if (info.mcp) {
    if (req.method === "GET") {
      res.writeHead(405, { ...hdr, allow: "POST,DELETE,OPTIONS" }).end();
      return;
    }
    if (req.method === "DELETE") {
      res.writeHead(204, hdr).end();
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405, { ...hdr, allow: "POST,DELETE,OPTIONS" }).end();
      return;
    }
    void readBody(req)
      .then(async (body) => {
        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          jsonError(res, 400, "Parse error");
          return;
        }
        try {
          const result = await handlePayload(payload);
          if (!result) {
            res.writeHead(202, hdr).end();
            return;
          }
          mcpResponse(req, res, result);
        } catch (error) {
          jsonError(res, 500, error instanceof Error ? error.message : "Internal error");
        }
      })
      .catch((error) => jsonError(res, 413, error instanceof Error ? error.message : "Bad request"));
    return;
  }

  if (url.pathname === "/") {
    res.writeHead(200, hdr).end(
      JSON.stringify({
        name: "The Anchor Tab MCP bridge",
        client: CLIENT,
        transport: TRANSPORT,
        version: VERSION,
        endpoint: "/mcp",
      }),
    );
    return;
  }

  res.writeHead(404, hdr).end();
});

server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the other helper or choose another port in Settings > AI connection.`,
    );
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const suffix = TOKEN ? `/t/${encodeURIComponent(TOKEN)}/mcp` : "/mcp";
  console.error(`Anchor ${CLIENT} bridge on http://${HOST}:${PORT} (${TRANSPORT})`);
  if (TRANSPORT === "http") {
    console.error(`MCP endpoint: http://${HOST}:${PORT}${suffix}`);
  }
});

if (TRANSPORT === "stdio") {
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      void (async () => {
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          sendStdio(rpcError(null, -32700, "Parse error"));
          return;
        }
        const response = await handlePayload(message);
        if (!response) return;
        if (Array.isArray(response)) response.forEach(sendStdio);
        else sendStdio(response);
      })();
    }
  });
}

function shutdown() {
  runtimesShutdown();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
}

function runtimesShutdown() {
  if (poller) {
    try {
      poller.writeHead(503, hdr).end();
    } catch {
      /* already closed */
    }
    poller = null;
  }
  waiting.forEach((waiter) => {
    clearTimeout(waiter.timer);
    waiter.reject(new Error("The Anchor bridge stopped."));
  });
  waiting.clear();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
