import { useSyncExternalStore } from "react";
import { AI_CLIENT_IDS, aiClientName } from "../lib/ai";
import { runMcpTool } from "../lib/mcp";
import type { AiClientId } from "../lib/types";
import { getAnchorState } from "./anchorStore";

export type McpStatus = "off" | "wait" | "on" | "bad";

type StatusMap = Record<AiClientId, McpStatus>;

const offStatuses = (): StatusMap =>
  AI_CLIENT_IDS.reduce(
    (out, id) => {
      out[id] = "off";
      return out;
    },
    {} as StatusMap,
  );

let statuses: StatusMap = offStatuses();
let log: string[] = [];
let generation = 0;
const runtimes = new Map<AiClientId, AbortController | null>();
const listeners = new Set<() => void>();

function publish(): void {
  listeners.forEach((l) => l());
}

function overallStatus(): McpStatus {
  if (!getAnchorState().ai.on) return "off";
  const values = AI_CLIENT_IDS.map((id) => statuses[id]);
  if (values.includes("on")) return "on";
  if (values.includes("bad")) return "bad";
  if (values.includes("wait")) return "wait";
  return "off";
}

function setStatus(id: AiClientId, next: McpStatus): void {
  if (statuses[id] === next) return;
  statuses = { ...statuses, [id]: next };
  publish();
}

function setAllStatuses(next: McpStatus): void {
  const values = offStatuses();
  AI_CLIENT_IDS.forEach((id) => {
    values[id] = next;
  });
  statuses = values;
  publish();
}

function setLog(next: string[]): void {
  log = next;
  publish();
}

export function logAi(
  tool: string,
  ok: boolean,
  error?: string,
  clientId: AiClientId = "claude",
): void {
  const prefix = clientId === "claude" ? "" : `[${aiClientName(clientId)}] `;
  const line =
    prefix +
    (ok ? "✓ " : "✕ ") +
    tool.replace("anchor_", "") +
    (error ? " · " + error : "") +
    " · " +
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  setLog([line, ...log].slice(0, 12));
}

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
const isAbort = (e: unknown) =>
  !!e && typeof e === "object" && (e as { name?: string }).name === "AbortError";

async function loop(clientId: AiClientId, gen: number): Promise<void> {
  while (gen === generation) {
    const state = getAnchorState();
    const client = state.ai.clients[clientId];
    if (!state.ai.on || !client?.on) break;

    const base = "http://127.0.0.1:" + (Number(client.port) || 7777);
    const headers = { "x-anchor-token": client.token, "content-type": "application/json" };
    const abort = new AbortController();
    runtimes.set(clientId, abort);
    try {
      const ping = await fetch(base + "/ping", { headers, signal: abort.signal });
      if (gen !== generation) break;
      if (ping.status === 401) {
        setStatus(clientId, "bad");
        await wait(4000);
        continue;
      }
      // Helper 1.x has no /ping; fall through to /next so older configs keep working.
      const legacyPing = ping.status === 404 || ping.status === 405;
      if (!ping.ok && !legacyPing) {
        setStatus(clientId, "wait");
        await wait(3000);
        continue;
      }
      if (ping.ok) setStatus(clientId, "on");
      const response = await fetch(base + "/next", { headers, signal: abort.signal });
      if (gen !== generation) break;
      if (response.status === 401) {
        setStatus(clientId, "bad");
        await wait(4000);
        continue;
      }
      if (response.status === 200 || response.status === 204) {
        setStatus(clientId, "on");
      }
      if (response.status === 200) {
        const cmd = (await response.json()) as {
          id: string;
          tool: string;
          args?: Record<string, unknown>;
        };
        let out: unknown;
        try {
          out = {
            id: cmd.id,
            ok: true,
            data: await runMcpTool(cmd.tool, cmd.args || {}, clientId),
          };
          logAi(cmd.tool, true, undefined, clientId);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          out = { id: cmd.id, ok: false, error: message };
          logAi(cmd.tool, false, message, clientId);
        }
        await fetch(base + "/result", {
          method: "POST",
          headers,
          body: JSON.stringify(out),
          signal: abort.signal,
        });
      }
    } catch (e) {
      if (gen !== generation) break;
      if (!isAbort(e)) {
        setStatus(clientId, "wait");
        await wait(3000);
      }
    } finally {
      if (runtimes.get(clientId) === abort) runtimes.delete(clientId);
    }
  }
  if (gen === generation) setStatus(clientId, "off");
}

export function startMcp(): void {
  generation += 1;
  runtimes.forEach((abort) => abort?.abort());
  runtimes.clear();

  const ai = getAnchorState().ai;
  const enabled = AI_CLIENT_IDS.filter((id) => ai.on && ai.clients[id]?.on);
  statuses = offStatuses();
  if (!enabled.length) {
    publish();
    return;
  }
  enabled.forEach((id) => {
    statuses[id] = "wait";
  });
  publish();

  const gen = generation;
  enabled.forEach((id) => {
    void loop(id, gen);
  });
}

export function stopMcp(): void {
  generation += 1;
  runtimes.forEach((abort) => abort?.abort());
  runtimes.clear();
  setAllStatuses("off");
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

let snapshot: { status: McpStatus; log: string[]; statuses: StatusMap } = {
  status: "off",
  log,
  statuses,
};
function getSnapshot() {
  const status = overallStatus();
  if (
    snapshot.status !== status ||
    snapshot.log !== log ||
    snapshot.statuses !== statuses
  ) {
    snapshot = { status, log, statuses };
  }
  return snapshot;
}

export function useMcp(): {
  status: McpStatus;
  log: string[];
  statuses: StatusMap;
} {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getMcpStatus(id?: AiClientId): McpStatus {
  return id ? statuses[id] : overallStatus();
}

export function getMcpStatuses(): StatusMap {
  return statuses;
}
