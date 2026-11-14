import { normalizeAppUrl } from "./launchpad";

export interface BookmarkEntry {
  title: string;
  url: string;
  folder: string;
  other: boolean;
}

export interface BookmarkFolder {
  key: string;
  label: string;
  count: number;
  other: boolean;
}

export interface BookmarkScan {
  entries: BookmarkEntry[];
  folders: BookmarkFolder[];
  barCount: number;
  otherCount: number;
}

export type BookmarkAccessCode =
  | "not-extension"
  | "outdated-build"
  | "missing-permission"
  | "read-failed";

export class BookmarkAccessError extends Error {
  readonly code: BookmarkAccessCode;

  constructor(code: BookmarkAccessCode, message: string) {
    super(message);
    this.name = "BookmarkAccessError";
    this.code = code;
  }
}

const hasBookmarks = (): boolean =>
  typeof chrome !== "undefined" && !!chrome.bookmarks && typeof chrome.bookmarks.getTree === "function";

const isExtensionPage = (): boolean => {
  try {
    return typeof location !== "undefined" && location.protocol === "chrome-extension:";
  } catch {
    return false;
  }
};

const hasExtensionContext = (): boolean => {
  if (!isExtensionPage() || typeof chrome === "undefined" || !chrome.runtime) return false;
  return !!chrome.runtime.id;
};

const manifestHasBookmarks = (manifest?: { permissions?: string[] }): boolean =>
  (manifest?.permissions || []).includes("bookmarks");

async function diskManifestHasBookmarks(): Promise<boolean | null> {
  try {
    if (typeof chrome === "undefined" || !chrome.runtime?.getURL) return null;
    const response = await fetch(chrome.runtime.getURL("manifest.json"), { cache: "no-store" });
    if (!response.ok) return null;
    const manifest = (await response.json()) as { permissions?: string[] };
    return manifestHasBookmarks(manifest);
  } catch {
    return null;
  }
}

export const canReloadExtension = (): boolean =>
  typeof chrome !== "undefined" && !!chrome.runtime && typeof chrome.runtime.reload === "function";

export function reloadExtension(): void {
  if (!canReloadExtension()) {
    throw new Error("Reload is only available inside the installed extension.");
  }
  chrome.runtime.reload();
}

function collect(
  node: chrome.bookmarks.BookmarkTreeNode,
  folder: string,
  other: boolean,
  out: BookmarkEntry[],
): void {
  if (node.url) {
    const url = normalizeAppUrl(node.url);
    if (url) out.push({ title: node.title || "", url, folder, other });
    return;
  }
  (node.children || []).forEach((child) => collect(child, folder, other, out));
}

export async function scanChromeBookmarks(): Promise<BookmarkScan> {
  if (!hasBookmarks()) {
    if (!hasExtensionContext()) {
      throw new BookmarkAccessError(
        "not-extension",
        "Bookmark import only works inside the installed extension. Open a new tab with The Anchor Tab, then go to Settings → Launchpad.",
      );
    }
    const diskHasBookmarks = await diskManifestHasBookmarks();
    if (diskHasBookmarks === false) {
      throw new BookmarkAccessError(
        "outdated-build",
        "The copy of The Anchor Tab loaded in Chrome is older than bookmark import. In chrome://extensions, remove it and load the updated app/dist folder with Load unpacked.",
      );
    }
    throw new BookmarkAccessError(
      "missing-permission",
      "The extension is running without bookmark access. Chrome needs one reload to apply the new permission. Click Reload extension, then reopen Settings → Launchpad and scan again.",
    );
  }

  let tree: chrome.bookmarks.BookmarkTreeNode[];
  try {
    tree = await chrome.bookmarks.getTree();
  } catch (error) {
    const detail = error instanceof Error && error.message ? ` (${error.message})` : "";
    throw new BookmarkAccessError(
      "read-failed",
      `Chrome could not read your bookmarks${detail}. Reload the extension from chrome://extensions and try again.`,
    );
  }

  const root = tree[0];
  const roots = root?.children || [];
  const bar = roots.find((n) => /bookmarks?\s*bar/i.test(n.title)) || roots[0];
  const otherRoots = roots.filter((n) => n !== bar);

  const entries: BookmarkEntry[] = [];
  const folders = new Map<string, BookmarkFolder>();

  const addFolder = (key: string, other: boolean, count: number) => {
    if (!count) return;
    const cur = folders.get(key);
    if (cur) cur.count += count;
    else folders.set(key, { key, label: key, count, other });
  };

  if (bar) {
    (bar.children || []).forEach((child) => {
      if (child.url) {
        const before = entries.length;
        collect(child, "Bookmarks", false, entries);
        const count = entries.length - before;
        addFolder("Bookmarks", false, count);
        return;
      }
      const before = entries.length;
      collect(child, child.title || "Bookmarks", false, entries);
      addFolder(child.title || "Bookmarks", false, entries.length - before);
    });
  }

  let otherCount = 0;
  otherRoots.forEach((node) => {
    const before = entries.length;
    collect(node, "Other bookmarks", true, entries);
    otherCount += entries.length - before;
  });
  addFolder("Other bookmarks", true, otherCount);

  const seen = new Set<string>();
  const unique = entries.filter((entry) => {
    const key = entry.url.replace(/\/+$/, "").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (const folder of folders.values()) {
    const keySet = new Set(
      unique.filter((e) => e.folder === folder.key).map((e) => e.url.replace(/\/+$/, "").toLowerCase()),
    );
    folder.count = keySet.size;
  }

  const barCount = unique.filter((e) => !e.other).length;
  otherCount = unique.filter((e) => e.other).length;

  return {
    entries: unique,
    folders: [...folders.values()].filter((f) => f.count > 0).sort((a, b) => a.label.localeCompare(b.label)),
    barCount,
    otherCount,
  };
}