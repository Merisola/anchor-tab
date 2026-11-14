import { useEffect, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Toggle } from "../../components/ui/Toggle";
import { AI_CLIENTS, aiClientMeta, AI_CLIENT_IDS } from "../../lib/ai";
import { newToken } from "../../lib/helpers";
import { mcpScopes } from "../../lib/mcp";
import { toast } from "../../lib/toast";
import type { AiClientId } from "../../lib/types";
import { setAi, setAiClient, setAiClientScope } from "../../state/actions";
import { useAnchorState } from "../../state/anchorStore";
import { useMcp } from "../../state/mcpStore";
import { useUi } from "../ui";

const HELPER = "/path/to/anchor-mcp-server.mjs";

function statusLabel(on: boolean, master: boolean, status: string): string {
  if (!master) return "Master switch is off";
  if (!on) return "Session is off";
  if (status === "bad") return "Token doesn’t match the helper";
  if (status === "on") return "Connected to the helper";
  if (status === "wait") return "Waiting for the helper…";
  return "Idle";
}

export function AiModal() {
  const ui = useUi();
  const state = useAnchorState();
  const { status, statuses, log } = useMcp();
  const open = ui.modal === "ai";
  const A = state.ai;
  const [active, setActive] = useState<AiClientId>("claude");
  const [showSetup, setShowSetup] = useState(false);
  const client = A.clients[active];
  const meta = aiClientMeta(active);
  const [port, setPort] = useState(String(client.port));

  useEffect(() => {
    if (!open) setShowSetup(false);
  }, [open]);

  const pickClient = (id: AiClientId) => {
    if (id === active) {
      setShowSetup((shown) => !shown);
      return;
    }
    setActive(id);
    setShowSetup(true);
  };

  useEffect(() => {
    if (!open) return;
    const clients = { ...A.clients };
    let changed = false;
    AI_CLIENT_IDS.forEach((id) => {
      if (clients[id].token) return;
      clients[id] = { ...clients[id], token: newToken() };
      changed = true;
    });
    if (changed) setAi({ clients });
  }, [open]);

  useEffect(() => {
    if (open) setPort(String(client.port));
  }, [open, active, client.port]);

  const commitPort = () => {
    const v = Math.round(+port);
    const next = v >= 1024 && v <= 65535 ? v : meta.port;
    setPort(String(next));
    setAiClient(active, { port: next });
  };

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch {
      toast("Press Ctrl/Cmd+C to copy.");
    }
  };

  const setClientEnabled = (enabled: boolean) => {
    setAiClient(active, {
      on: enabled,
      ...(enabled && !client.token ? { token: newToken() } : {}),
    });
  };

  const serverName = "anchor-tab";
  const stdioConfig = JSON.stringify(
    {
      mcpServers: {
        [serverName]: {
          command: "node",
          args: [HELPER],
          env: {
            ANCHOR_TOKEN: client.token,
            ANCHOR_PORT: String(client.port),
            ANCHOR_CLIENT: active,
          },
        },
      },
    },
    null,
    2,
  );
  const cliCommand =
    (active === "gemini" ? "gemini" : "claude") +
    " mcp add " +
    serverName +
    " -e ANCHOR_TOKEN=" +
    client.token +
    " -e ANCHOR_PORT=" +
    client.port +
    " -e ANCHOR_CLIENT=" +
    active +
    " -- node " +
    HELPER;
  const genericCommand =
    "ANCHOR_TOKEN=" +
    client.token +
    " ANCHOR_PORT=" +
    client.port +
    " ANCHOR_CLIENT=generic node " +
    HELPER;
  const bridgeCommand =
    '$env:ANCHOR_CLIENT="chatgpt"; $env:ANCHOR_TRANSPORT="http"; $env:ANCHOR_PORT="' +
    client.port +
    '"; $env:ANCHOR_TOKEN="' +
    client.token +
    '"; node ' +
    HELPER;
  const tunnelCommand = "cloudflared tunnel --url http://127.0.0.1:" + client.port;
  const tunnelBase = String(client.tunnelUrl || "")
    .trim()
    .replace(/\/+$/, "");
  const publicBase = tunnelBase
    ? /^https?:\/\//i.test(tunnelBase)
      ? tunnelBase
      : "https://" + tunnelBase
    : "";
  const connectorPath = "/t/" + encodeURIComponent(client.token) + "/mcp";
  const localEndpoint = "http://127.0.0.1:" + client.port + connectorPath;
  const connectorUrl = (publicBase || localEndpoint) + (publicBase ? connectorPath : "");

  const enabledCount = AI_CLIENT_IDS.filter((id) => A.clients[id].on).length;
  const connectedCount = AI_CLIENT_IDS.filter((id) => statuses[id] === "on").length;
  const masterText = !A.on
    ? "Off"
    : status === "bad" && !connectedCount
      ? "A helper token doesn’t match"
      : status === "on"
        ? connectedCount === 1 && enabledCount === 1
          ? "Connected to the helper"
          : `${connectedCount} of ${enabledCount} sessions connected`
        : "Waiting for the helper… is anchor-mcp-server running?";
  const statusClass =
    status === "on" ? "aistat-on" : status === "bad" ? "aistat-bad" : "";

  return (
    <Modal open={open} onClose={ui.close} wide>
      <div className="eyebrow">AI connection · MCP</div>
      <h2>Let an AI help run your tab</h2>
      <p>
        Four isolated sessions share this one page. Each app gets its own port, secret token and
        permissions, so Claude, Gemini CLI, ChatGPT and another MCP client can connect at the same
        time. Everything stays on your computer, and the page must be open for changes to apply.
      </p>

      <div className="setrow">
        <div>
          <b>Allow AI to connect</b>
          <small id="aiStat" className={statusClass}>
            {masterText}
          </small>
        </div>
        <Toggle checked={!!A.on} onChange={(v) => setAi({ on: v })} />
      </div>

      <span className="lbl">Client sessions</span>
      <div className="ai-clients">
        {AI_CLIENTS.map((item) => {
          const current = A.clients[item.id];
          const s = statuses[item.id];
          return (
            <div
              key={item.id}
              className={
                "ai-client" + (showSetup && active === item.id ? " active" : "")
              }
            >
              <button
                type="button"
                className="ai-client-pick"
                aria-expanded={active === item.id && showSetup}
                aria-controls="aiClientSetup"
                title={
                  active === item.id && showSetup ? "Hide setup" : "Open setup"
                }
                onClick={() => pickClient(item.id)}
              >
                <span className="ai-client-mark" aria-hidden="true">
                  {item.id === "claude"
                    ? "C"
                    : item.id === "gemini"
                      ? "G"
                      : item.id === "chatgpt"
                        ? "◎"
                        : "M"}
                </span>
                <span className="ai-client-copy">
                  <span className="ai-client-name">
                    <b>{item.name}</b>
                    <span
                      className={"ai-dot ai-dot-" + (A.on && current.on ? s : "off")}
                      title={statusLabel(current.on, A.on, s)}
                    />
                  </span>
                  <small>
                    {current.port} · {item.transport === "http" ? "HTTP tunnel" : "stdio"}
                  </small>
                </span>
                <span
                  className={"ai-client-caret" + (active === item.id && showSetup ? " open" : "")}
                  aria-hidden="true"
                />
              </button>
              <Toggle
                checked={!!current.on}
                onChange={(v) => {
                  if (item.id === active) setClientEnabled(v);
                  else
                    setAiClient(item.id, {
                      on: v,
                      ...(v && !current.token ? { token: newToken() } : {}),
                    });
                }}
              />
            </div>
          );
        })}
      </div>
      {!showSetup ? (
        <p className="hint ai-clients-hint">Choose a session to open its setup.</p>
      ) : null}

      <div className="ai-client-detail" id="aiClientSetup" hidden={!showSetup}>
        <div className="ai-detail-head">
          <div>
            <b>{meta.name}</b>
            <small>{meta.blurb}</small>
          </div>
          <div className="ai-detail-side">
            <span
              className={
                "ai-status-pill" +
                (A.on && client.on && statuses[active] === "on" ? " on" : "") +
                (A.on && client.on && statuses[active] === "bad" ? " bad" : "")
              }
            >
              {statusLabel(client.on, A.on, statuses[active])}
            </span>
            <button
              className="ai-detail-toggle"
              type="button"
              onClick={() => setShowSetup(false)}
            >
              Hide setup
            </button>
          </div>
        </div>

        <div className="setrow ai-session-row">
          <div>
            <b>Enable this session</b>
            <small>
              {meta.transport === "http"
                ? "Runs a streamable HTTP MCP endpoint on this port."
                : "Starts a separate local stdio bridge for this app."}
            </small>
          </div>
          <Toggle checked={!!client.on} onChange={setClientEnabled} />
        </div>

        <span className="lbl">What {meta.name} may change</span>
        <div className="seg" id="aiScopes">
          {mcpScopes().map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={client.scopes[key] ? "on" : ""}
              onClick={() => setAiClientScope(active, key, !client.scopes[key])}
            >
              {client.scopes[key] ? "✓ " : ""}
              {label}
            </button>
          ))}
        </div>

        <div className="fields2">
          <label className="cf">
            <span>Port</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              onBlur={commitPort}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
              }}
            />
          </label>
          <label className="cf ai-token">
            <span>Secret token</span>
            <input type="text" readOnly value={client.token} />
          </label>
        </div>

        {active === "chatgpt" ? (
          <label className="cf">
            <span>Public tunnel URL</span>
            <input
              type="text"
              placeholder="https://your-tunnel.trycloudflare.com"
              value={client.tunnelUrl || ""}
              onChange={(e) => setAiClient("chatgpt", { tunnelUrl: e.target.value })}
            />
          </label>
        ) : null}

        <div className="irow2" style={{ marginTop: 8 }}>
          <button
            className="btn quiet sm"
            type="button"
            onClick={() => void copy(client.token, "Token copied.")}
          >
            Copy token
          </button>
          <button
            className="btn quiet sm"
            type="button"
            onClick={() => {
              setAiClient(active, { token: newToken() });
              toast("New token. Update this client’s config.");
            }}
          >
            New token
          </button>
        </div>

        {active === "chatgpt" ? (
          <>
            <span className="lbl">1 · Start the HTTP bridge (PowerShell)</span>
            <textarea className="apps-ta" readOnly value={bridgeCommand} style={{ minHeight: 92 }} />
            <div className="irow2">
              <button
                className="btn secondary sm"
                type="button"
                onClick={() => void copy(bridgeCommand, "Bridge command copied.")}
              >
                Copy command
              </button>
            </div>
            <span className="lbl">2 · Expose it with an HTTPS tunnel</span>
            <textarea className="apps-ta" readOnly value={tunnelCommand} style={{ minHeight: 62 }} />
            <div className="irow2">
              <button
                className="btn secondary sm"
                type="button"
                onClick={() => void copy(tunnelCommand, "Tunnel command copied.")}
              >
                Copy tunnel command
              </button>
            </div>
            <span className="lbl">3 · Add this URL as a ChatGPT connector</span>
            <div className="ai-endpoint">
              <code>{connectorUrl}</code>
              <button
                className="btn secondary sm"
                type="button"
                onClick={() => void copy(connectorUrl, "Connector URL copied.")}
              >
                Copy URL
              </button>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              The token is inside the URL path, so choose “No authentication” in ChatGPT. Paste the
              tunnel’s public hostname above after it starts. Keep the tunnel URL private: anyone
              with it can reach this session.
            </p>
          </>
        ) : (
          <>
            <span className="lbl">1 · MCP config</span>
            <textarea className="apps-ta" readOnly value={stdioConfig} style={{ minHeight: 150 }} />
            <div className="irow2">
              <button
                className="btn secondary sm"
                type="button"
                onClick={() => void copy(stdioConfig, "Config copied.")}
              >
                Copy config
              </button>
            </div>
            <span className="lbl">
              {active === "claude"
                ? "or Claude Code"
                : active === "gemini"
                  ? "or Gemini CLI"
                  : "or launch it directly"}
            </span>
            <textarea
              className="apps-ta"
              readOnly
              value={active === "generic" ? genericCommand : cliCommand}
              style={{ minHeight: 64 }}
            />
            <div className="irow2">
              <button
                className="btn secondary sm"
                type="button"
                onClick={() =>
                  void copy(
                    active === "generic" ? genericCommand : cliCommand,
                    "Command copied.",
                  )
                }
              >
                Copy command
              </button>
            </div>
          </>
        )}

        <p className="hint" style={{ marginTop: 12 }}>
          Replace <b>/path/to</b> with the folder that holds{" "}
          <code>anchor-mcp-server.mjs</code> (needs Node 18+). Restart the AI app, keep this page
          open, then try: “add a task to review my résumé” or “add a Calendar app to my launchpad”.
        </p>
      </div>

      <span className="lbl">Recent AI activity</span>
      <div className="hint" id="aiLog" style={{ whiteSpace: "pre-wrap" }}>
        {!log.length ? "Nothing yet." : log.map((line, i) => <div key={i}>{line}</div>)}
      </div>
      <div className="modal-actions">
        <button className="btn primary" type="button" onClick={ui.close}>
          Done
        </button>
      </div>
    </Modal>
  );
}
