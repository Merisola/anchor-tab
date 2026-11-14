import { useState } from "react";
import {
  BookmarkAccessError,
  canReloadExtension,
  reloadExtension,
  scanChromeBookmarks,
  type BookmarkScan,
} from "../lib/bookmarks";
import { launchpadOptions } from "../lib/launchpad";
import { skipLeaveGuard } from "../lib/leaveGuard";
import { toast } from "../lib/toast";
import {
  importBookmarkEntries,
  removeLaunchpadCategory,
  removeLaunchpadLabel,
  setLaunchpadPrefs,
} from "../state/actions";
import { useAnchorState } from "../state/anchorStore";

export function LaunchpadSettings() {
  const state = useAnchorState();
  const prefs = state.launchpadPrefs;
  const [scan, setScan] = useState<BookmarkScan | null>(null);
  const [scanError, setScanError] = useState<BookmarkAccessError | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>(() => ({
    ...prefs.bookmarkFolders,
  }));
  const [includeOther, setIncludeOther] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const options = launchpadOptions(state.apps, prefs);

  const scanNow = async () => {
    setBusy(true);
    try {
      const result = await scanChromeBookmarks();
      setScan(result);
      setScanError(null);
      setMapping((prev) => {
        const next = { ...prev };
        result.folders.forEach((folder) => {
          if (!next[folder.key]) {
            next[folder.key] = prefs.bookmarkFolders[folder.key] || folder.key;
          }
        });
        return next;
      });
      toast(
        result.entries.length
          ? `Found ${result.entries.length} bookmarks in ${result.folders.length} folders.`
          : "No http(s) bookmarks found.",
      );
    } catch (error) {
      const next =
        error instanceof BookmarkAccessError
          ? error
          : new BookmarkAccessError(
              "read-failed",
              error instanceof Error ? error.message : "Could not read Chrome bookmarks.",
            );
      setScan(null);
      setScanError(next);
      toast(next.message);
    } finally {
      setBusy(false);
    }
  };

  const reloadNow = () => {
    if (!canReloadExtension()) {
      toast("Open chrome://extensions and reload The Anchor Tab.");
      return;
    }
    skipLeaveGuard(5000);
    reloadExtension();
  };

  const updateMapping = (key: string, value: string) => {
    setMapping((prev) => ({ ...prev, [key]: value }));
  };

  const selected = scan
    ? scan.entries.filter((entry) => includeOther || !entry.other)
    : [];

  const runImport = () => {
    if (!scan) return;
    if (!selected.length) {
      toast("No bookmarks selected to import.");
      return;
    }
    setLaunchpadPrefs({ bookmarkFolders: mapping });
    const result = importBookmarkEntries(selected, mapping);
    toast(
      `Added ${result.added} bookmark${result.added === 1 ? "" : "s"}` +
        (result.skipped ? `, skipped ${result.skipped} already saved.` : "."),
    );
  };

  const addCategory = () => {
    const value = newCategory.trim().slice(0, 30);
    if (!value) return;
    setLaunchpadPrefs({ categories: [...prefs.categories, value] });
    setNewCategory("");
    toast("Category saved.");
  };

  const addLabel = () => {
    const value = newLabel.trim().slice(0, 30);
    if (!value) return;
    setLaunchpadPrefs({ labels: [...prefs.labels, value] });
    setNewLabel("");
    toast("Label saved.");
  };

  const lastImport = prefs.lastImportAt
    ? new Date(prefs.lastImportAt).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const scanErrorTitle =
    scanError?.code === "missing-permission"
      ? "One reload needed"
      : scanError?.code === "outdated-build"
        ? "Older extension copy"
        : scanError?.code === "not-extension"
          ? "Open the installed extension"
          : "Bookmark access unavailable";

  return (
    <>
      <p>
        Import your Chrome bookmarks once, then keep them organised with folder-to-category
        mappings and reusable labels. Re-importing is safe: links already in your launchpad are
        skipped.
      </p>

      <div className="setrow">
        <div>
          <b>Open the full launchpad</b>
          <small>Search, filter by category or label, and edit apps on their own page.</small>
        </div>
        <a
          className="btn secondary"
          href="launchpad.html"
          style={{ textDecoration: "none" }}
          onClick={() => skipLeaveGuard(4000)}
        >
          Open
        </a>
      </div>

      <div className="settings-divider">
        <b>Chrome bookmarks</b>
        <small>
          {prefs.bookmarkImportDone
            ? `Last imported${lastImport ? " " + lastImport : ""}. Re-import skips duplicates.`
            : "Reads only from your local Chrome profile."}
        </small>
        <button className="btn secondary" type="button" onClick={scanNow} disabled={busy}>
          {busy ? "Scanning…" : scan ? "Rescan folders" : "Scan bookmarks"}
        </button>
      </div>

      {scanError ? (
        <div className="lp-scan-error" role="alert">
          <div>
            <b>{scanErrorTitle}</b>
            <span>{scanError.message}</span>
          </div>
          {canReloadExtension() &&
          (scanError.code === "missing-permission" || scanError.code === "read-failed") ? (
            <button
              className="btn secondary"
              type="button"
              onClick={reloadNow}
              title="Reloads the extension and applies the bookmark permission. This Settings tab will close; reopen it and scan again."
            >
              Reload extension
            </button>
          ) : null}
        </div>
      ) : null}

      {scan ? (
        <>
          <div className="lp-scan-note">
            <span>
              <b>{scan.barCount}</b> in the Bookmarks bar
            </span>
            <span>
              <b>{scan.otherCount}</b> in Other bookmarks
            </span>
          </div>

          {scan.otherCount ? (
            <label className="lp-check-row">
              <input
                type="checkbox"
                checked={includeOther}
                onChange={(e) => setIncludeOther(e.target.checked)}
              />{" "}
              Include Other bookmarks ({scan.otherCount})
            </label>
          ) : null}

          {scan.folders.length ? (
            <div className="lp-map">
              <div className="lp-map-head">
                <span>Bookmark folder</span>
                <span>Launchpad category</span>
              </div>
              {scan.folders.map((folder) => (
                <div className="lp-map-row" key={folder.key}>
                  <span>
                    {folder.label}
                    <small>
                      {folder.count} link{folder.count === 1 ? "" : "s"}
                      {folder.other ? " · Other bookmarks" : ""}
                    </small>
                  </span>
                  <input
                    value={mapping[folder.key] ?? folder.key}
                    maxLength={30}
                    onChange={(e) => updateMapping(folder.key, e.target.value)}
                    aria-label={`Category for ${folder.label}`}
                  />
                </div>
              ))}
            </div>
          ) : null}

          <div className="settings-actions">
            <button className="btn primary" type="button" onClick={runImport}>
              Import {selected.length} bookmark{selected.length === 1 ? "" : "s"}
            </button>
            <button className="btn quiet" type="button" onClick={scanNow} disabled={busy}>
              Refresh folders
            </button>
          </div>
        </>
      ) : (
        <p className="hint">
          Scan to preview folders and choose which category each one becomes. Direct Bookmarks bar
          links become “Bookmarks”.
        </p>
      )}

      <div className="settings-divider">
        <b>Categories</b>
        <small>Reusable categories for apps and bookmark mappings.</small>
      </div>
      <div className="lp-lib">
        {options.categories.length ? (
          options.categories.map((value) => (
            <span className="lp-lib-chip" key={value}>
              {value}
              <button
                type="button"
                aria-label={`Remove category ${value}`}
                onClick={() => removeLaunchpadCategory(value)}
              >
                ×
              </button>
            </span>
          ))
        ) : (
          <span className="hint">No categories yet.</span>
        )}
      </div>
      <div className="add-row" style={{ marginTop: 9 }}>
        <input
          maxLength={30}
          placeholder="Add a category, e.g. Work"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCategory();
            }
          }}
        />
        <button className="btn quiet" type="button" onClick={addCategory}>
          Add
        </button>
      </div>

      <div className="settings-divider">
        <b>Labels</b>
        <small>Labels can stack on an app, unlike its single category.</small>
      </div>
      <div className="lp-lib">
        {options.labels.length ? (
          options.labels.map((value) => (
            <span className="lp-lib-chip" key={value}>
              {value}
              <button
                type="button"
                aria-label={`Remove label ${value}`}
                onClick={() => removeLaunchpadLabel(value)}
              >
                ×
              </button>
            </span>
          ))
        ) : (
          <span className="hint">No labels yet.</span>
        )}
      </div>
      <div className="add-row" style={{ marginTop: 9 }}>
        <input
          maxLength={30}
          placeholder="Add a label, e.g. deep-work"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addLabel();
            }
          }}
        />
        <button className="btn quiet" type="button" onClick={addLabel}>
          Add
        </button>
      </div>
    </>
  );
}