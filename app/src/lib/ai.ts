import type {
  AiClientConfig,
  AiClientId,
  AiConfig,
  AiScope,
  AiTransport,
} from "./types";

export interface AiClientMeta {
  id: AiClientId;
  name: string;
  short: string;
  transport: AiTransport;
  port: number;
  blurb: string;
}

/** The four fixed client slots. Ports stay stable so saved configs keep working. */
export const AI_CLIENTS: AiClientMeta[] = [
  {
    id: "claude",
    name: "Claude",
    short: "Claude Desktop / Code",
    transport: "stdio",
    port: 7777,
    blurb: "Local stdio bridge for Claude Desktop and Claude Code.",
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    short: "Gemini CLI",
    transport: "stdio",
    port: 7778,
    blurb: "A separate local stdio bridge for Gemini CLI.",
  },
  {
    id: "chatgpt",
    name: "ChatGPT web",
    short: "ChatGPT custom connector",
    transport: "http",
    port: 7779,
    blurb: "A streamable HTTP bridge you can expose through an HTTPS tunnel.",
  },
  {
    id: "generic",
    name: "Generic MCP",
    short: "Any MCP client",
    transport: "stdio",
    port: 7780,
    blurb: "A spare stdio bridge for another MCP app or test client.",
  },
];

export const AI_CLIENT_IDS = AI_CLIENTS.map((client) => client.id);

export function isAiClientId(value: string): value is AiClientId {
  return AI_CLIENT_IDS.includes(value as AiClientId);
}

export function aiClientMeta(id: AiClientId): AiClientMeta {
  return AI_CLIENTS.find((client) => client.id === id) || AI_CLIENTS[0];
}

export function aiClientName(id: AiClientId): string {
  return aiClientMeta(id).name;
}

export function aiScopes(on = true): Record<AiScope, boolean> {
  return {
    tasks: on,
    launchpad: on,
    fields: on,
    widgets: on,
    appearance: on,
  };
}

export function cleanPort(value: unknown, fallback: number): number {
  const port = Math.round(Number(value));
  return Number.isFinite(port) && port >= 1024 && port <= 65535 ? port : fallback;
}

function cleanScopes(raw: unknown): Record<AiScope, boolean> {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    tasks: value.tasks !== false,
    launchpad: value.launchpad !== false,
    fields: value.fields !== false,
    widgets: value.widgets !== false,
    appearance: value.appearance !== false,
  };
}

function cleanClient(raw: unknown, meta: AiClientMeta): AiClientConfig {
  const value = raw && typeof raw === "object" ? (raw as Partial<AiClientConfig>) : {};
  return {
    on: !!value.on,
    port: cleanPort(value.port, meta.port),
    token: String(value.token || ""),
    scopes: cleanScopes(value.scopes),
    ...(meta.id === "chatgpt"
      ? { tunnelUrl: String(value.tunnelUrl || "").trim().slice(0, 500) }
      : {}),
  };
}

export function defaultAiClients(): Record<AiClientId, AiClientConfig> {
  return AI_CLIENTS.reduce(
    (out, meta) => {
      out[meta.id] = cleanClient(null, meta);
      return out;
    },
    {} as Record<AiClientId, AiClientConfig>,
  );
}

export function aiClient(ai: AiConfig, id: AiClientId): AiClientConfig {
  const saved = ai.clients && ai.clients[id];
  return cleanClient(saved || (id === "claude" ? ai : null), aiClientMeta(id));
}

/**
 * Accepts both the original single-client shape and the four-session shape.
 * Old installs keep their port, token and scopes as the Claude slot.
 */
export function normalizeAiConfig(raw: Partial<AiConfig> | null | undefined): AiConfig {
  const source = raw && typeof raw === "object" ? raw : {};
  const clients = defaultAiClients();
  let hasClients = false;
  if (source.clients && typeof source.clients === "object") {
    AI_CLIENTS.forEach((meta) => {
      const saved = (source.clients as Partial<Record<AiClientId, AiClientConfig>>)[meta.id];
      if (!saved || typeof saved !== "object") return;
      hasClients = true;
      clients[meta.id] = cleanClient(saved, meta);
    });
  }
  if (!hasClients) {
    clients.claude = cleanClient(
      {
        on: source.on,
        port: source.port,
        token: source.token,
        scopes: source.scopes,
      },
      aiClientMeta("claude"),
    );
  }

  const claude = clients.claude;
  const anyOn = AI_CLIENT_IDS.some((id) => clients[id].on);
  return {
    on: typeof source.on === "boolean" ? source.on : anyOn,
    port: claude.port,
    token: claude.token,
    scopes: { ...claude.scopes },
    clients,
  };
}

/** Legacy/global fields still map to Claude; clients[] is the multi-client path. */
export function updateAiConfig(current: AiConfig, patch: Partial<AiConfig>): AiConfig {
  const base = normalizeAiConfig(current);
  const clients = defaultAiClients();
  AI_CLIENT_IDS.forEach((id) => {
    clients[id] = {
      ...base.clients[id],
      scopes: { ...base.clients[id].scopes },
    };
  });

  if (patch.clients && typeof patch.clients === "object") {
    AI_CLIENTS.forEach((meta) => {
      const next = (patch.clients as Partial<Record<AiClientId, AiClientConfig>>)[meta.id];
      if (!next || typeof next !== "object") return;
      clients[meta.id] = cleanClient({ ...clients[meta.id], ...next }, meta);
    });
  }

  if (patch.port !== undefined || patch.token !== undefined || patch.scopes !== undefined) {
    clients.claude = cleanClient(
      {
        ...clients.claude,
        port: patch.port !== undefined ? patch.port : clients.claude.port,
        token: patch.token !== undefined ? patch.token : clients.claude.token,
        scopes: patch.scopes !== undefined ? patch.scopes : clients.claude.scopes,
      },
      aiClientMeta("claude"),
    );
  }

  const on = patch.on !== undefined ? !!patch.on : base.on;
  let anyOn = AI_CLIENT_IDS.some((id) => clients[id].on);
  if (on && !anyOn) {
    clients.claude = { ...clients.claude, on: true };
    anyOn = true;
  }

  const claude = clients.claude;
  return {
    on,
    port: claude.port,
    token: claude.token,
    scopes: { ...claude.scopes },
    clients,
  };
}

export function updateAiClient(
  current: AiConfig,
  id: AiClientId,
  patch: Partial<AiClientConfig>,
): AiConfig {
  const base = normalizeAiConfig(current);
  const next = cleanClient({ ...base.clients[id], ...patch }, aiClientMeta(id));
  return updateAiConfig(base, {
    on: next.on ? true : base.on,
    clients: { ...base.clients, [id]: next },
  });
}

/** Only connection fields matter for restarting the page's bridge loops. */
export function mcpRuntimeKey(ai: AiConfig): string {
  const clients = normalizeAiConfig(ai).clients;
  return [
    ai.on ? "on" : "off",
    ...AI_CLIENTS.map((meta) => {
      const client = clients[meta.id];
      return `${meta.id}:${client.on ? 1 : 0}:${client.port}:${client.token}`;
    }),
  ].join("|");
}
