import { AI_CLIENT_IDS, updateAiClient, updateAiConfig } from "../lib/ai";
import { defaults } from "../lib/defaults";
import { clone, maxMoves, mkTask, newToken, parseQuick } from "../lib/helpers";
import { appKey, makeLaunchpadApp, mergeApps } from "../lib/launchpad";
import type { BookmarkEntry } from "../lib/bookmarks";
import type {
  AiClientConfig,
  AiClientId,
  AiConfig,
  AiScope,
  AnchorState,
  BacklogItem,
  LaunchpadApp,
  LaunchpadPrefs,
  Look,
  Priority,
  Settings,
  Task,
  Widget,
} from "../lib/types";
import { getAnchorState, mutateAnchor } from "./anchorStore";
import { resolveLayout } from "../newtab/layout/model";

const activeCount = (s: AnchorState) => s.tasks.filter((t) => !t.done).length;
export const slotsFull = (s: AnchorState = getAnchorState()) => activeCount(s) >= maxMoves(s.set.max);

export function setMotto(text: string): void {
  mutateAnchor((s) => ({ ...s, motto: text.trim() || defaults.motto }));
}

export function setNow(text: string): void {
  mutateAnchor((s) => ({ ...s, now: text }));
}

export function addTask(raw: string, extra?: Partial<Task>): { ok: boolean; text?: string; reason?: string } {
  const q = parseQuick(raw);
  if (!q.text) return { ok: false, reason: "empty" };
  const s = getAnchorState();
  if (slotsFull(s)) return { ok: false, reason: "full" };
  const task = mkTask(q.text, { ...q.x, ...(extra || {}) });
  mutateAnchor((cur) => ({ ...cur, tasks: [...cur.tasks, task] }));
  return { ok: true, text: task.text };
}

export function updateTask(index: number, updates: Partial<Task>): void {
  mutateAnchor((s) => {
    const old = s.tasks[index];
    if (!old) return s;
    const next = s.tasks.slice();
    next[index] = { ...old, ...updates };
    return { ...s, tasks: next, now: updates.text && s.now === old.text ? updates.text : s.now };
  });
}

export function toggleTask(index: number): void {
  mutateAnchor((s) => {
    const old = s.tasks[index];
    if (!old) return s;
    const done = !old.done;
    const next = s.tasks.slice();
    next[index] = { ...old, done };
    return { ...s, tasks: next, now: done && s.now === old.text ? "" : s.now };
  });
}

export function removeTask(index: number): void {
  mutateAnchor((s) => {
    const old = s.tasks[index];
    if (!old) return s;
    return { ...s, tasks: s.tasks.filter((_, i) => i !== index), now: s.now === old.text ? "" : s.now };
  });
}

export function clearCompleted(): void {
  mutateAnchor((s) => ({ ...s, tasks: s.tasks.filter((t) => !t.done) }));
}

export function deferTask(index: number): void {
  mutateAnchor((s) => {
    const t = s.tasks[index];
    if (!t) return s;
    const item: BacklogItem = {
      text: t.text,
      done: false,
      project: t.project || "",
      due: t.due || "",
      pri: t.pri || "",
      note: t.note || "",
      from: "today",
      added: Date.now(),
    };
    return {
      ...s,
      tasks: s.tasks.filter((_, i) => i !== index),
      backlog: [...s.backlog, item],
      now: s.now === t.text ? "" : s.now,
    };
  });
}

export function addBacklog(raw: string, extra?: Partial<BacklogItem>, from = "manual"): { ok: boolean; text?: string } {
  const q = parseQuick(raw);
  if (!q.text) return { ok: false };
  const item: BacklogItem = {
    text: q.text.slice(0, 100),
    done: false,
    project: "",
    due: "",
    pri: "",
    note: "",
    ...q.x,
    ...(extra || {}),
    from,
    added: Date.now(),
  };
  mutateAnchor((s) => ({ ...s, backlog: [...s.backlog, item] }));
  return { ok: true, text: item.text };
}

export function updateBacklog(index: number, updates: Partial<BacklogItem>): void {
  mutateAnchor((s) => {
    if (!s.backlog[index]) return s;
    const backlog = s.backlog.slice();
    backlog[index] = { ...backlog[index], ...updates };
    return { ...s, backlog };
  });
}

export function removeBacklog(index: number): void {
  mutateAnchor((s) => ({ ...s, backlog: s.backlog.filter((_, i) => i !== index) }));
}

export function pullBacklog(index: number): boolean {
  const s = getAnchorState();
  if (slotsFull(s)) return false;
  const item = s.backlog[index];
  if (!item) return false;
  mutateAnchor((cur) => ({
    ...cur,
    backlog: cur.backlog.filter((_, i) => i !== index),
    tasks: [...cur.tasks, mkTask(item.text, { project: item.project, due: item.due, pri: item.pri, note: item.note })],
  }));
  return true;
}

export function pullBacklogItem(item: BacklogItem): boolean {
  const index = getAnchorState().backlog.indexOf(item);
  return index >= 0 ? pullBacklog(index) : false;
}

export function parkThought(text: string): boolean {
  const value = text.trim().slice(0, 200);
  if (!value) return false;
  mutateAnchor((s) => ({ ...s, parked: [...s.parked, { text: value, time: Date.now() }] }));
  return true;
}

export function updateParked(index: number, text: string): void {
  const value = text.trim().slice(0, 200);
  if (!value) return;
  mutateAnchor((s) => {
    if (!s.parked[index]) return s;
    const parked = s.parked.slice();
    parked[index] = { ...parked[index], text: value };
    return { ...s, parked };
  });
}

export function removeParked(index: number): void {
  mutateAnchor((s) => ({ ...s, parked: s.parked.filter((_, i) => i !== index) }));
}

export function promoteParked(index: number, target: "task" | "backlog"): boolean {
  const s = getAnchorState();
  const item = s.parked[index];
  if (!item) return false;
  if (target === "task") {
    const res = addTask(item.text);
    if (!res.ok) return false;
  } else {
    addBacklog(item.text, {}, "park");
  }
  removeParked(index);
  return true;
}

export function setApps(apps: LaunchpadApp[]): void {
  mutateAnchor((s) => ({ ...s, apps }));
}

export function setLaunchpadPrefs(patch: Partial<LaunchpadPrefs>): void {
  mutateAnchor((s) => ({
    ...s,
    launchpadPrefs: {
      ...s.launchpadPrefs,
      ...patch,
      categories: patch.categories ? [...new Set(patch.categories.map((x) => x.trim()).filter(Boolean))] : s.launchpadPrefs.categories,
      labels: patch.labels ? [...new Set(patch.labels.map((x) => x.trim()).filter(Boolean))] : s.launchpadPrefs.labels,
      bookmarkFolders: patch.bookmarkFolders
        ? { ...s.launchpadPrefs.bookmarkFolders, ...patch.bookmarkFolders }
        : s.launchpadPrefs.bookmarkFolders,
    },
  }));
}

export function rememberLaunchpadOptions(categories: string[], labels: string[]): void {
  mutateAnchor((s) => ({
    ...s,
    launchpadPrefs: {
      ...s.launchpadPrefs,
      categories: [...new Set([...s.launchpadPrefs.categories, ...categories.map((x) => x.trim()).filter(Boolean)])],
      labels: [...new Set([...s.launchpadPrefs.labels, ...labels.map((x) => x.trim()).filter(Boolean)])],
    },
  }));
}

export function addLaunchpadApp(input: Partial<LaunchpadApp> & { url: string }): boolean {
  const app = makeLaunchpadApp(input);
  if (!app) return false;
  const s = getAnchorState();
  if (s.apps.some((x) => appKey(x.url) === appKey(app.url))) return false;
  mutateAnchor((cur) => ({ ...cur, apps: [...cur.apps, app] }));
  return true;
}

export function updateLaunchpadApp(index: number, patch: Partial<LaunchpadApp>): boolean {
  const current = getAnchorState().apps[index];
  if (!current) return false;
  const next = makeLaunchpadApp({
    ...current,
    ...patch,
    url: patch.url ?? current.url,
    addedAt: current.addedAt || Date.now(),
    opens: current.opens || 0,
    lastOpenedAt: current.lastOpenedAt || 0,
  });
  if (!next) return false;
  const key = appKey(next.url);
  if (getAnchorState().apps.some((app, i) => i !== index && appKey(app.url) === key)) return false;
  mutateAnchor((s) => {
    const apps = s.apps.slice();
    if (!apps[index]) return s;
    apps[index] = next;
    return { ...s, apps };
  });
  return true;
}

export function removeLaunchpadApp(index: number): void {
  mutateAnchor((s) => ({ ...s, apps: s.apps.filter((_, i) => i !== index) }));
}

export function recordAppOpen(url: string): void {
  const key = appKey(url);
  if (!key) return;
  mutateAnchor((s) => ({
    ...s,
    apps: s.apps.map((app) =>
      appKey(app.url) === key
        ? { ...app, opens: (app.opens || 0) + 1, lastOpenedAt: Date.now() }
        : app,
    ),
  }));
}

export function removeLaunchpadLabel(label: string): void {
  const value = label.trim();
  if (!value) return;
  mutateAnchor((s) => ({
    ...s,
    apps: s.apps.map((app) => ({
      ...app,
      labels: (app.labels || []).filter((x) => x.toLowerCase() !== value.toLowerCase()),
    })),
    launchpadPrefs: {
      ...s.launchpadPrefs,
      labels: s.launchpadPrefs.labels.filter((x) => x.toLowerCase() !== value.toLowerCase()),
    },
  }));
}

export function removeLaunchpadCategory(category: string): void {
  const value = category.trim();
  if (!value) return;
  mutateAnchor((s) => ({
    ...s,
    apps: s.apps.map((app) =>
      (app.category || "").toLowerCase() === value.toLowerCase()
        ? { ...app, category: "" }
        : app,
    ),
    launchpadPrefs: {
      ...s.launchpadPrefs,
      categories: s.launchpadPrefs.categories.filter((x) => x.toLowerCase() !== value.toLowerCase()),
    },
  }));
}

export function importBookmarkEntries(
  entries: BookmarkEntry[],
  mapping: Record<string, string>,
): { added: number; skipped: number } {
  const incoming = entries
    .map((entry) => {
      const category = (mapping[entry.folder] || entry.folder || "Bookmarks").trim() || "Bookmarks";
      return makeLaunchpadApp({
        name: entry.title,
        url: entry.url,
        category,
        tag: category,
        icon: "↗",
        labels: [],
        source: "bookmark",
        addedAt: Date.now(),
      });
    })
    .filter((x): x is LaunchpadApp => !!x);
  const merged = mergeApps(getAnchorState().apps, incoming);
  mutateAnchor((s) => ({
    ...s,
    apps: merged.apps,
    launchpadPrefs: {
      ...s.launchpadPrefs,
      categories: [...new Set([...s.launchpadPrefs.categories, ...incoming.map((a) => a.category || "").filter(Boolean)])],
      bookmarkImportDone: true,
      lastImportAt: Date.now(),
    },
  }));
  return { added: merged.added, skipped: merged.skipped };
}

export function startBreakSnapshot(seconds: number): void {
  const secs = Math.max(1, Math.round(seconds));
  mutateAnchor((s) => ({
    ...s,
    alarm: null,
    timer: {
      phase: "break",
      long: false,
      total: secs,
      remaining: secs,
      running: true,
      endAt: Date.now() + secs * 1000,
    },
  }));
}

export function setVault(patch: Partial<Pick<AnchorState, "resumeUrl" | "careerNotes" | "archiveNotes">>): void {
  mutateAnchor((s) => ({ ...s, ...patch }));
}

export function setSettings(patch: Partial<Settings>): void {
  mutateAnchor((s) => ({ ...s, set: { ...s.set, ...patch } }));
}

export function setLook(patch: Partial<Look>): void {
  mutateAnchor((s) => ({ ...s, look: { ...s.look, ...patch } }));
}

function withAiTokens(ai: AiConfig): AiConfig {
  if (!ai.on) return ai;
  let changed = false;
  const clients = { ...ai.clients };
  AI_CLIENT_IDS.forEach((id) => {
    const client = clients[id];
    if (!client?.on || client.token) return;
    clients[id] = { ...client, token: newToken() };
    changed = true;
  });
  if (!changed) return ai;
  return updateAiConfig(ai, { clients });
}

export function setAi(patch: Partial<AiConfig>): void {
  mutateAnchor((s) => ({ ...s, ai: withAiTokens(updateAiConfig(s.ai, patch)) }));
}

export function setAiClient(id: AiClientId, patch: Partial<AiClientConfig>): void {
  mutateAnchor((s) => ({ ...s, ai: withAiTokens(updateAiClient(s.ai, id, patch)) }));
}

export function setAiClientScope(id: AiClientId, scope: AiScope, on: boolean): void {
  mutateAnchor((s) => {
    const client = s.ai.clients[id];
    if (!client) return s;
    return {
      ...s,
      ai: updateAiClient(s.ai, id, { scopes: { ...client.scopes, [scope]: on } }),
    };
  });
}

/** Kept for older callers; the original single client is now the Claude slot. */
export function setAiScope(scope: AiScope, on: boolean): void {
  setAiClientScope("claude", scope, on);
}

export function setWidgets(widgets: Widget[]): void {
  mutateAnchor((s) => ({ ...s, widgets }));
}

export function addWidget(widget: Widget, position: number, name?: string): void {
  mutateAnchor((s) => {
    const layout = resolveLayout(s);
    layout.splice(Math.max(0, Math.min(layout.length, position)), 0, {
      id: "w:" + widget.id,
      size: widget.size,
      hidden: false,
      ...(name ? { name } : {}),
    });
    return { ...s, widgets: [...s.widgets, widget], layout };
  });
}

export function updateWidget(id: string, patch: Partial<Widget>): void {
  mutateAnchor((s) => ({
    ...s,
    widgets: s.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    layout: s.layout.map((e) => (e.id === "w:" + id && patch.size ? { ...e, size: patch.size } : e)),
  }));
}

export function removeWidget(id: string): void {
  mutateAnchor((s) => ({
    ...s,
    widgets: s.widgets.filter((w) => w.id !== id),
    layout: s.layout.filter((e) => e.id !== "w:" + id),
  }));
}

export function updateLayoutEntry(id: string, patch: Partial<AnchorState["layout"][number]>): void {
  mutateAnchor((s) => ({
    ...s,
    layout: s.layout.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  }));
}

export function resetLayout(): void {
  mutateAnchor((s) => ({ ...s, layout: [] }));
}

export function updateLayout(next: AnchorState["layout"]): void {
  mutateAnchor((s) => ({ ...s, layout: next }));
}

export function setPriorityValue(item: Task | BacklogItem, priority: Priority): void {
  item.pri = priority;
}

export function replaceStateFromBackup(
  incoming: Partial<AnchorState>,
  keep: Pick<AnchorState, "timer" | "ai" | "alarm">,
): AnchorState {
  const base = clone(getAnchorState());
  return {
    ...base,
    ...incoming,
    set: { ...base.set, ...(incoming.set || {}) },
    stats: { ...base.stats, ...(incoming.stats || {}) },
    hist: incoming.hist || {},
    look: { ...base.look, ...(incoming.look || {}) },
    launchpadPrefs: { ...base.launchpadPrefs, ...(incoming.launchpadPrefs || {}) },
    ai: keep.ai,
    timer: keep.timer,
    alarm: keep.alarm,
    tasks: Array.isArray(incoming.tasks) ? incoming.tasks : [],
    backlog: Array.isArray(incoming.backlog) ? incoming.backlog : [],
    parked: Array.isArray(incoming.parked) ? incoming.parked : [],
    widgets: Array.isArray(incoming.widgets) ? incoming.widgets : [],
    layout: Array.isArray(incoming.layout) ? incoming.layout : [],
    apps: Array.isArray(incoming.apps) ? incoming.apps : base.apps,
  };
}