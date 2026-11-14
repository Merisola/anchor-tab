import { useSyncExternalStore } from "react";
import { normalizeAiConfig } from "../lib/ai";
import { clone } from "../lib/helpers";
import { appCategory, appKey, appLabels, normalizeAppUrl } from "../lib/launchpad";
import { defaults } from "../lib/defaults";
import { storageGet, storageSet } from "../lib/storage";
import type { AnchorState, LaunchpadApp, LaunchpadPrefs, TimerState } from "../lib/types";

const KEY = "anchorState";

let state: AnchorState = clone(defaults);
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function cleanApps(raw: LaunchpadApp[] | undefined): LaunchpadApp[] {
  const list = Array.isArray(raw) ? raw : defaults.apps;
  const seen = new Set<string>();
  const out: LaunchpadApp[] = [];
  list.forEach((app) => {
    const url = normalizeAppUrl(app?.url || "");
    const key = appKey(url);
    if (!url || !key || seen.has(key)) return;
    seen.add(key);
    const category = appCategory(app);
    out.push({
      ...app,
      name: String(app?.name || "").trim().slice(0, 80) || "App",
      url,
      tag: String(app?.tag || category || "Tool").trim().slice(0, 24) || "Tool",
      category,
      labels: appLabels(app),
      source: app?.source || "manual",
      addedAt: app?.addedAt || 0,
      lastOpenedAt: app?.lastOpenedAt || 0,
      opens: Math.max(0, Math.round(Number(app?.opens) || 0)),
    });
  });
  return out;
}

function cleanPrefs(raw: LaunchpadPrefs | undefined): LaunchpadPrefs {
  const base = defaults.launchpadPrefs;
  const value = raw || base;
  return {
    ...base,
    ...value,
    categories: [...new Set((Array.isArray(value.categories) ? value.categories : []).map((x) => String(x || "").trim()).filter(Boolean))],
    labels: [...new Set((Array.isArray(value.labels) ? value.labels : []).map((x) => String(x || "").trim()).filter(Boolean))],
    bookmarkFolders: { ...(value.bookmarkFolders && typeof value.bookmarkFolders === "object" ? value.bookmarkFolders : {}) },
    bookmarkImportDone: !!value.bookmarkImportDone,
  };
}

function mergeState(saved: Partial<AnchorState> | null): AnchorState {
  const source = saved || {};
  return {
    ...clone(defaults),
    ...source,
    motto:
      !source.motto || source.motto === "Focus over chaos."
        ? defaults.motto
        : source.motto,
    set: { ...defaults.set, ...(source.set || {}) },
    stats: { ...defaults.stats, ...(source.stats || {}) },
    hist: source.hist || {},
    look: { ...defaults.look, ...(source.look || {}) },
    ai: normalizeAiConfig(source.ai),
    launchpadPrefs: cleanPrefs(source.launchpadPrefs),
    tasks: Array.isArray(source.tasks) ? source.tasks : [],
    backlog: Array.isArray(source.backlog) ? source.backlog : [],
    parked: Array.isArray(source.parked) ? source.parked : [],
    widgets: Array.isArray(source.widgets) ? source.widgets : [],
    layout: Array.isArray(source.layout) ? source.layout : [],
    apps: cleanApps(source.apps),
  };
}

export async function initAnchorState(): Promise<void> {
  if (hydrated) return;
  const saved = await storageGet<Partial<AnchorState>>(KEY);
  state = mergeState(saved);
  hydrated = true;
  emit();
}

export function getAnchorState(): AnchorState {
  return state;
}

export function subscribeAnchor(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAnchorState(): AnchorState {
  return useSyncExternalStore(subscribeAnchor, getAnchorState, getAnchorState);
}

let saveTimer: number | undefined;
let saveQueue: Promise<void> = Promise.resolve();

function scheduleSave(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const snapshot = state;
    saveQueue = saveQueue.then(async () => {
      await storageSet(KEY, snapshot);
    });
  }, 250);
}

export function flushAnchorState(): Promise<void> {
  window.clearTimeout(saveTimer);
  const snapshot = state;
  saveQueue = saveQueue.then(async () => {
    await storageSet(KEY, snapshot);
  });
  return saveQueue;
}

export function mutateAnchor(updater: (s: AnchorState) => AnchorState): AnchorState {
  state = updater(state);
  emit();
  scheduleSave();
  return state;
}

export function replaceAnchorState(next: AnchorState, persist = true): void {
  state = next;
  emit();
  if (persist) scheduleSave();
}

export function updateTimerSnapshot(timer: TimerState | null): void {
  state = { ...state, timer };
  emit();
  scheduleSave();
}

window.addEventListener("pagehide", () => {
  if (!hydrated) return;
  void storageSet(KEY, state);
});