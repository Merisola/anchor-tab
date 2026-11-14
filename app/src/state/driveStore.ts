import { useSyncExternalStore } from "react";
import { storageGet, storageSet } from "../lib/storage";
import { toast } from "../lib/toast";
import type { BackupPayload, DriveConfig, Field } from "../lib/types";

const CFG_KEY = "anchorDrive";
const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const FILE_NAME = "anchor-backup.json";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

interface DriveFileMeta {
  id: string;
  modifiedTime: string;
  size?: string;
}

interface DriveHost {
  collect: () => Promise<BackupPayload>;
  apply: (payload: BackupPayload) => Promise<void>;
  toast: (message: string) => void;
}

export interface DriveSnapshot {
  hasIdentity: boolean;
  clientId: string;
  connected: boolean;
  auto: boolean;
  busy: boolean;
  conflict: boolean;
  needsReconnect: boolean;
  lastSync: number;
  note: string;
  restoreArmed: boolean;
  pendingOverwrite: boolean;
  redirectUri: string;
}

const hasIdentity =
  typeof chrome !== "undefined" && !!chrome.identity && !!chrome.identity.launchWebAuthFlow;

let cfg: DriveConfig = {
  clientId: "",
  connected: false,
  auto: false,
  token: "",
  exp: 0,
  remoteMod: "",
  lastHash: "",
  lastSync: 0,
  adoptHash: false,
  deviceId: "",
};
let host: DriveHost | null = null;
let initialized = false;
let busy = false;
let conflict = false;
let needsReconnect = false;
let pendingOverwrite = false;
let restoreArmed = false;
let lastTry = 0;
let noteText = "";
let restoreTimer: number | undefined;
let overwriteTimer: number | undefined;
const listeners = new Set<() => void>();

function redirectUri(): string {
  try {
    return hasIdentity ? chrome.identity.getRedirectURL() : "";
  } catch {
    return "";
  }
}

let snapshot: DriveSnapshot = {
  hasIdentity,
  clientId: "",
  connected: false,
  auto: false,
  busy: false,
  conflict: false,
  needsReconnect: false,
  lastSync: 0,
  note: "",
  restoreArmed: false,
  pendingOverwrite: false,
  redirectUri: redirectUri(),
};

function publish(): void {
  snapshot = {
    hasIdentity,
    clientId: cfg.clientId,
    connected: cfg.connected,
    auto: cfg.auto,
    busy,
    conflict,
    needsReconnect,
    lastSync: cfg.lastSync,
    note: noteText,
    restoreArmed,
    pendingOverwrite,
    redirectUri: redirectUri(),
  };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDrive(): DriveSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

function note(message: string): void {
  noteText = message || "";
  publish();
}

function hash(s: string): string {
  let a = 0xdeadbeef;
  let b = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 2654435761);
    b = Math.imul(b ^ c, 1597334677);
  }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36);
}

const ago = (t: number): string => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return Math.round(s / 60) + " min ago";
  if (s < 86400) return Math.round(s / 3600) + " h ago";
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

const when = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

async function loadCfg(): Promise<void> {
  try {
    const x = await storageGet<Partial<DriveConfig>>(CFG_KEY);
    cfg = { ...cfg, ...(x || {}) };
  } catch {
    /* ignore */
  }
  if (!cfg.deviceId) {
    cfg.deviceId = Math.random().toString(36).slice(2, 10);
    await saveCfg();
  }
}

async function saveCfg(): Promise<void> {
  try {
    await storageSet(CFG_KEY, cfg);
  } catch {
    /* ignore */
  }
}

async function getToken(interactive: boolean): Promise<string> {
  if (cfg.token && cfg.exp - Date.now() > 60000) return cfg.token;
  if (!cfg.clientId) throw new Error("Add your Google client ID first.");
  if (!hasIdentity) throw new Error("Google Drive only works in the installed extension.");
  const p = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "token",
    scope: SCOPE,
    redirect_uri: chrome.identity.getRedirectURL(),
    include_granted_scopes: "true",
  });
  const back = await chrome.identity.launchWebAuthFlow({
    url: "https://accounts.google.com/o/oauth2/v2/auth?" + p.toString(),
    interactive: !!interactive,
  });
  if (!back) throw new Error("Google did not return a token.");
  const q = new URLSearchParams(new URL(back).hash.slice(1));
  const tok = q.get("access_token");
  if (!tok) throw new Error(q.get("error") || "Google did not return a token.");
  cfg.token = tok;
  cfg.exp = Date.now() + (+(q.get("expires_in") || 3600) || 3600) * 1000;
  await saveCfg();
  return tok;
}

async function drive(url: string, opts: RequestInit = {}, interactive = false, retry = true): Promise<Response> {
  const token = await getToken(interactive);
  const r = await fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: "Bearer " + token },
  });
  if (r.status === 401 && retry) {
    cfg.token = "";
    cfg.exp = 0;
    await saveCfg();
    return drive(url, opts, interactive, false);
  }
  if (!r.ok) {
    let m = "";
    try {
      const j = (await r.json()) as { error?: { message?: string } };
      m = j.error?.message || "";
    } catch {
      /* ignore */
    }
    const err = new Error(m || "Google Drive error " + r.status) as Error & { status?: number };
    err.status = r.status;
    throw err;
  }
  return r;
}

async function findFile(interactive: boolean): Promise<DriveFileMeta | null> {
  const p = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name='${FILE_NAME}' and trashed=false`,
    fields: "files(id,modifiedTime,size)",
    orderBy: "modifiedTime desc",
    pageSize: "1",
  });
  const r = await drive(`${API}/files?${p}`, {}, interactive);
  const j = (await r.json()) as { files?: DriveFileMeta[] };
  return (j.files || [])[0] || null;
}

async function writeFile(existing: DriveFileMeta | null, json: string, interactive: boolean): Promise<DriveFileMeta> {
  if (existing) {
    const r = await drive(
      `${UPLOAD}/files/${existing.id}?uploadType=media&fields=id,modifiedTime`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: json },
      interactive,
    );
    return (await r.json()) as DriveFileMeta;
  }
  const b = "anchor" + Math.random().toString(36).slice(2);
  const body =
    `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: FILE_NAME, parents: ["appDataFolder"] }) +
    `\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${b}--`;
  const r = await drive(
    `${UPLOAD}/files?uploadType=multipart&fields=id,modifiedTime`,
    { method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + b }, body },
    interactive,
  );
  return (await r.json()) as DriveFileMeta;
}

async function backup({ force = false, interactive = false }: { force?: boolean; interactive?: boolean } = {}): Promise<"ok" | "conflict"> {
  if (!host) throw new Error("Not ready.");
  const core = await host.collect();
  const h = hash(JSON.stringify(core));
  const meta = await findFile(interactive);
  conflict = !!meta && meta.modifiedTime !== cfg.remoteMod;
  if (conflict && !force) return "conflict";
  const json = JSON.stringify({ app: "anchor", v: 1, savedAt: new Date().toISOString(), device: cfg.deviceId, ...core });
  const out = await writeFile(meta, json, interactive);
  cfg.remoteMod = out.modifiedTime;
  cfg.lastHash = h;
  cfg.lastSync = Date.now();
  conflict = false;
  needsReconnect = false;
  await saveCfg();
  publish();
  return "ok";
}

async function restore(interactive: boolean): Promise<void> {
  if (!host) throw new Error("Not ready.");
  const meta = await findFile(interactive);
  if (!meta) throw new Error("There is no backup in your Drive yet.");
  const r = await drive(`${API}/files/${meta.id}?alt=media`, {}, interactive);
  const data = (await r.json()) as { app?: string; state?: Record<string, unknown>; fields?: Field[] };
  if (!data || data.app !== "anchor" || !data.state || !Array.isArray((data.state as { tasks?: unknown }).tasks)) {
    throw new Error("That file is not an Anchor backup.");
  }
  try {
    const current = await host.collect();
    await chrome.storage.local.set({ anchorPreRestore: { at: Date.now(), ...current } });
  } catch {
    /* ignore */
  }
  cfg.remoteMod = meta.modifiedTime;
  cfg.lastSync = Date.now();
  cfg.adoptHash = true;
  conflict = false;
  await saveCfg();
  await host.apply({ state: data.state as BackupPayload["state"], fields: data.fields || null });
}

async function disconnect(): Promise<void> {
  const t = cfg.token;
  if (t) {
    try {
      await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(t), { method: "POST" });
    } catch {
      /* ignore */
    }
  }
  cfg = {
    ...cfg,
    connected: false,
    auto: false,
    token: "",
    exp: 0,
    remoteMod: "",
    lastHash: "",
    lastSync: 0,
    adoptHash: false,
  };
  conflict = false;
  needsReconnect = false;
  pendingOverwrite = false;
  await saveCfg();
  note("Disconnected. Your backup stays in Drive until you delete it there.");
}

function fail(e: unknown, interactive: boolean): void {
  const m = String((e as Error)?.message || e);
  console.warn("Anchor Drive:", e);
  if (!interactive && /interaction|not approve|cancel|could not be loaded/i.test(m)) {
    needsReconnect = true;
    note("");
    return;
  }
  if (/not approve|cancel/i.test(m)) return note("Sign-in was cancelled.");
  if (/could not be loaded/i.test(m)) {
    return note("Google refused the sign-in. Check the redirect URI in your OAuth client matches exactly, and that your Google account is listed as a test user.");
  }
  if (/has not been used|is disabled|accessNotConfigured/i.test(m)) {
    return note("Turn on the Google Drive API for your project (APIs & Services → Library), then try again.");
  }
  note(m);
}

async function guard(fn: () => Promise<void>): Promise<void> {
  if (busy) return;
  busy = true;
  publish();
  try {
    await fn();
  } finally {
    busy = false;
    publish();
  }
}

async function tick(urgent: boolean): Promise<void> {
  if (!hasIdentity || !cfg.connected || !cfg.auto || busy || needsReconnect || conflict || !host) return;
  if (!urgent && Date.now() - lastTry < 45000) return;
  const core = await host.collect();
  if (hash(JSON.stringify(core)) === cfg.lastHash) return;
  lastTry = Date.now();
  await guard(async () => {
    try {
      if ((await backup({ interactive: false })) === "conflict") {
        note("Auto-backup paused: Drive has a backup this device hasn't seen. Open Google Drive backup in Settings.");
      }
    } catch (e) {
      fail(e, false);
    }
  });
}

async function checkRemote(): Promise<void> {
  if (!hasIdentity || !cfg.connected) return;
  await guard(async () => {
    try {
      const meta = await findFile(false);
      conflict = !!meta && meta.modifiedTime !== cfg.remoteMod;
      if (conflict && cfg.remoteMod) host?.toast("A newer backup from another device is in Google Drive. Open Settings → Google Drive backup.");
      publish();
    } catch (e) {
      fail(e, false);
    }
  });
}

export async function initDrive(h: DriveHost): Promise<void> {
  if (initialized) {
    host = h;
    publish();
    return;
  }
  initialized = true;
  host = h;
  await loadCfg();
  if (cfg.adoptHash) {
    cfg.lastHash = hash(JSON.stringify(await host.collect()));
    cfg.adoptHash = false;
    await saveCfg();
  }
  publish();
  if (!hasIdentity) return;
  window.setTimeout(() => void checkRemote(), 1500);
  window.setInterval(() => void tick(false), 60000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) void tick(true);
  });
}

export function saveClientId(value: string): boolean {
  const v = value.trim();
  if (!/^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(v)) {
    note("That doesn't look like a client ID. It ends in .apps.googleusercontent.com");
    return false;
  }
  cfg.clientId = v;
  cfg.token = "";
  cfg.exp = 0;
  void saveCfg();
  note("Client ID saved. Now press Connect.");
  return true;
}

export function connectDrive(): void {
  if (cfg.connected && !needsReconnect) {
    void guard(async () => {
      try {
        await disconnect();
      } catch {
        /* ignore */
      }
    });
    return;
  }
  void guard(async () => {
    try {
      cfg.token = "";
      cfg.exp = 0;
      await getToken(true);
      cfg.connected = true;
      needsReconnect = false;
      await saveCfg();
      const meta = await findFile(true);
      conflict = !!meta && meta.modifiedTime !== cfg.remoteMod;
      note(
        conflict && meta
          ? `Connected. Drive already has a backup from ${when(meta.modifiedTime)}. Restore it, or back up to replace it.`
          : "Connected.",
      );
      publish();
    } catch (e) {
      fail(e, true);
    }
  });
}

export function backupNow(): void {
  void guard(async () => {
    try {
      const r = await backup({ force: pendingOverwrite, interactive: true });
      if (r === "conflict") {
        pendingOverwrite = true;
        window.clearTimeout(overwriteTimer);
        overwriteTimer = window.setTimeout(() => {
          pendingOverwrite = false;
          publish();
        }, 8000);
        note("Drive has a different backup. Press again to replace it, or restore it instead.");
      } else {
        pendingOverwrite = false;
        note("Backed up to Google Drive.");
      }
    } catch (e) {
      fail(e, true);
    }
  });
}

export function restoreFromDrive(): void {
  if (!restoreArmed) {
    restoreArmed = true;
    publish();
    window.clearTimeout(restoreTimer);
    restoreTimer = window.setTimeout(() => {
      restoreArmed = false;
      publish();
    }, 4000);
    return;
  }
  restoreArmed = false;
  void guard(async () => {
    try {
      await restore(true);
    } catch (e) {
      fail(e, true);
    }
  });
}

export function setDriveAuto(on: boolean): void {
  cfg.auto = on;
  void saveCfg();
  note(on ? "Auto-backup on. It runs about a minute after you change something." : "Auto-backup off.");
}

export async function copyDriveRedirect(): Promise<void> {
  try {
    await navigator.clipboard.writeText(redirectUri());
    toast("Redirect URI copied.");
  } catch {
    toast("Press Ctrl/Cmd+C to copy the redirect URI.");
  }
}

export const driveStatusText = (snap: DriveSnapshot): string => {
  if (!snap.hasIdentity) return "Only works in the installed extension, not on a plain web page.";
  if (!snap.clientId) return "Not set up yet.";
  if (!snap.connected) return "Ready to connect.";
  if (snap.needsReconnect) return "Signed out. Reconnect to keep backing up.";
  if (snap.conflict) return "Drive has a different backup (another device or an earlier install).";
  return snap.lastSync ? "Last backup " + ago(snap.lastSync) + "." : "Connected. No backup yet.";
};