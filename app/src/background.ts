// The Anchor Tab · background worker
// Keeps focus-timer alerts working even when no new tab is open, and
// saves the current page or a right-clicked link to the Launchpad.
import { defaults } from "./lib/defaults";
import { makeSavedPageApp, mergeApps } from "./lib/launchpad";
import type { AnchorState, LaunchpadApp } from "./lib/types";

const KEY = "anchorState";
const ALARM = "anchor-timer";
const PAGE_MENU = "anchor-save-page";
const LINK_MENU = "anchor-save-link";

function sync(state: AnchorState | null | undefined): void {
  const t = state && state.timer;
  if (t && t.running && t.endAt > Date.now()) chrome.alarms.create(ALARM, { when: t.endAt });
  else void chrome.alarms.clear(ALARM);
}

const boot = (): void => {
  void chrome.storage.local.get(KEY).then((x) => sync(x[KEY] as AnchorState | null));
};

function installMenus(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: PAGE_MENU,
      title: "Save page to Anchor Launchpad",
      contexts: ["page"],
    });
    chrome.contextMenus.create({
      id: LINK_MENU,
      title: "Save link to Anchor Launchpad",
      contexts: ["link"],
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  installMenus();
  boot();
});
chrome.runtime.onStartup.addListener(boot);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[KEY]) sync(changes[KEY].newValue as AnchorState | null);
});

function notify(title: string, message: string): void {
  void chrome.notifications.create("anchor-save", {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message,
  });
}

async function savePage(url: string, title: string): Promise<void> {
  const app = makeSavedPageApp(url, title);
  if (!app) {
    notify("Could not save page", "Only http(s) pages can be saved.");
    return;
  }
  const stored = (await chrome.storage.local.get(KEY))[KEY] as AnchorState | undefined;
  const state = stored || defaults;
  const apps = Array.isArray(state.apps) ? state.apps : ([] as LaunchpadApp[]);
  const merged = mergeApps(apps, [app]);
  if (!merged.added) {
    notify("Already in your Launchpad", `${app.name} is already saved.`);
    return;
  }
  const prefs = state.launchpadPrefs || defaults.launchpadPrefs;
  const categories = [...new Set([...(prefs.categories || []), "Saved"])];
  await chrome.storage.local.set({
    [KEY]: {
      ...state,
      apps: merged.apps,
      launchpadPrefs: {
        ...defaults.launchpadPrefs,
        ...prefs,
        categories,
      },
    },
  });
  notify("Saved to Launchpad", `${app.name} was added to the Saved category.`);
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== PAGE_MENU && info.menuItemId !== LINK_MENU) return;
  const isLink = info.menuItemId === LINK_MENU;
  const url = (isLink ? info.linkUrl : info.pageUrl || tab?.url) || "";
  const title = isLink ? "" : tab?.title || "";
  void savePage(url, title);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM) return;
  await new Promise((resolve) => setTimeout(resolve, 1800)); // let an open tab handle it first
  const st = (await chrome.storage.local.get(KEY))[KEY] as AnchorState | null;
  const t = st && st.timer;
  if (!t || !t.running || t.endAt > Date.now() + 1000) return;
  const focus = t.phase === "focus";
  void chrome.notifications.create("anchor-alarm", {
    type: "basic",
    iconUrl: "icons/icon128.png",
    priority: 2,
    requireInteraction: true,
    title: focus ? "Focus session complete" : "Break is over",
    message: focus
      ? "Time's up. Open a new tab to choose your next step."
      : "Your break ended. Time to come back.",
  });
});

const openTab = (): void => {
  void chrome.tabs.create({});
};
chrome.notifications.onClicked.addListener((id) => {
  void chrome.notifications.clear(id);
  openTab();
});
chrome.action.onClicked.addListener(openTab);