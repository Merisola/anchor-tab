import { normUrl } from "./helpers";
import type { LaunchpadApp, LaunchpadPrefs } from "./types";

export const normalizeAppUrl = (value: string): string => {
  const url = normUrl(value);
  return url === "#" ? "" : url;
};

export const appKey = (url: string): string => normalizeAppUrl(url).replace(/\/+$/, "").toLowerCase();

export const appHost = (url: string): string => {
  try {
    return new URL(normalizeAppUrl(url)).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
};

export const appNameFromUrl = (url: string): string => appHost(url) || "Saved page";

export const appCategory = (app: LaunchpadApp): string =>
  String((app.category !== undefined ? app.category : app.tag) || "").trim();

export const appLabels = (app: { labels?: string[] }): string[] => {
  const seen = new Set<string>();
  return (Array.isArray(app.labels) ? app.labels : [])
    .map((x) => String(x || "").trim())
    .filter((x) => {
      const key = x.toLowerCase();
      if (!x || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
};

export function makeLaunchpadApp(input: Partial<LaunchpadApp> & { url: string }): LaunchpadApp | null {
  const url = normalizeAppUrl(input.url);
  if (!url) return null;
  const name = String(input.name || "").trim().slice(0, 80) || appNameFromUrl(url);
  const category = String((input.category !== undefined ? input.category : input.tag) || "")
    .trim()
    .slice(0, 30);
  return {
    name,
    url,
    tag: String(input.tag || category || "Tool").trim().slice(0, 24) || "Tool",
    icon: String(input.icon || "↗").trim().slice(0, 2) || "↗",
    guard: !!input.guard,
    category,
    labels: appLabels(input),
    source: input.source || "manual",
    addedAt: input.addedAt || Date.now(),
    lastOpenedAt: input.lastOpenedAt || 0,
    opens: Math.max(0, Math.round(Number(input.opens) || 0)),
  };
}

export function makeSavedPageApp(url: string, title?: string): LaunchpadApp | null {
  const clean = normalizeAppUrl(url);
  if (!clean) return null;
  return makeLaunchpadApp({
    name: String(title || "").trim().slice(0, 80) || appNameFromUrl(clean),
    url: clean,
    category: "Saved",
    tag: "Saved",
    icon: "↗",
    labels: [],
    source: "saved",
    addedAt: Date.now(),
  });
}

export function mergeApps(
  existing: LaunchpadApp[],
  incoming: LaunchpadApp[],
): { apps: LaunchpadApp[]; added: number; skipped: number } {
  const apps = existing.slice();
  const seen = new Set(apps.map((a) => appKey(a.url)).filter(Boolean));
  let added = 0;
  let skipped = 0;
  incoming.forEach((app) => {
    const key = appKey(app.url);
    if (!key || seen.has(key)) {
      skipped += 1;
      return;
    }
    seen.add(key);
    apps.push(app);
    added += 1;
  });
  return { apps, added, skipped };
}

export function launchpadOptions(apps: LaunchpadApp[], prefs: LaunchpadPrefs) {
  const categories = new Set<string>();
  const labels = new Set<string>();
  (prefs.categories || []).forEach((x) => x && categories.add(x));
  (prefs.labels || []).forEach((x) => x && labels.add(x));
  apps.forEach((app) => {
    const category = appCategory(app);
    if (category) categories.add(category);
    appLabels(app).forEach((x) => labels.add(x));
  });
  return {
    categories: [...categories].sort((a, b) => a.localeCompare(b)),
    labels: [...labels].sort((a, b) => a.localeCompare(b)),
  };
}

export function faviconUrl(url: string): string {
  const clean = normalizeAppUrl(url);
  if (!clean) return "";
  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    if (typeof chrome === "undefined" || !chrome.runtime?.getURL) return "";
    return chrome.runtime.getURL("/_favicon/?pageUrl=" + encodeURIComponent(clean) + "&size=32");
  } catch {
    return "";
  }
}