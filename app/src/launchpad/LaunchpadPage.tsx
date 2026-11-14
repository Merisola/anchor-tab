import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { AppIcon } from "../components/AppIcon";
import { Modal } from "../components/ui/Modal";
import { safeUrl } from "../lib/helpers";
import { skipLeaveGuard } from "../lib/leaveGuard";
import { applyLook } from "../lib/look";
import {
  appCategory,
  appHost,
  appKey,
  appLabels,
  launchpadOptions,
  normalizeAppUrl,
} from "../lib/launchpad";
import { toast } from "../lib/toast";
import type { LaunchpadApp } from "../lib/types";
import {
  addLaunchpadApp,
  recordAppOpen,
  rememberLaunchpadOptions,
  removeLaunchpadApp,
  startBreakSnapshot,
  updateLaunchpadApp,
} from "../state/actions";
import { useAnchorState } from "../state/anchorStore";
import { useBackground } from "../state/backgroundStore";

type Usage = "all" | "recent" | "unused" | "most";
type SortKey = "recent" | "name" | "added" | "most";

const DAY = 86_400_000;
const GUARD = /youtube|instagram|tiktok|reddit|facebook|x\.com|twitter/i;

const needsGuard = (app: LaunchpadApp): boolean =>
  !!app.guard || GUARD.test(app.url + " " + app.name);

const parseLabels = (value: string): string[] => {
  const seen = new Set<string>();
  return value
    .split(",")
    .map((x) => x.trim())
    .filter((x) => {
      const key = x.toLowerCase();
      if (!x || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
};

interface FormState {
  name: string;
  url: string;
  icon: string;
  category: string;
  labels: string;
  guard: boolean;
}

const blankForm = (): FormState => ({
  name: "",
  url: "",
  icon: "↗",
  category: "",
  labels: "",
  guard: false,
});

function lastOpenedLabel(app: LaunchpadApp): string {
  if (!app.lastOpenedAt) return "Never opened";
  const diff = Date.now() - app.lastOpenedAt;
  if (diff < 60_000) return "Opened just now";
  if (diff < 3_600_000) return `Opened ${Math.max(1, Math.round(diff / 60_000))} min ago`;
  if (diff < DAY) return `Opened ${Math.max(1, Math.round(diff / 3_600_000))} hr ago`;
  return "Opened " + new Date(app.lastOpenedAt).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function LaunchpadPage() {
  const state = useAnchorState();
  const bg = useBackground();
  const bgRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");
  const [usage, setUsage] = useState<Usage>("all");
  const [category, setCategory] = useState("all");
  const [label, setLabel] = useState("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [gateApp, setGateApp] = useState<LaunchpadApp | null>(null);

  useEffect(() => {
    applyLook(state.look, bg.image, bg.samples, bgRef.current);
  }, [state.look, bg]);

  useEffect(() => {
    document.title = "Launchpad · The Anchor Tab";
  }, []);

  const options = useMemo(
    () => launchpadOptions(state.apps, state.launchpadPrefs),
    [state.apps, state.launchpadPrefs],
  );

  const timer = state.timer;
  const focusing =
    !!timer && timer.running && timer.phase === "focus" && timer.endAt > Date.now();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = state.apps
      .map((app, index) => ({ app, index }))
      .filter(({ app }) => {
        if (q) {
          const haystack = [
            app.name,
            app.url,
            app.tag,
            appCategory(app),
            ...appLabels(app),
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        if (category !== "all" && appCategory(app).toLowerCase() !== category.toLowerCase()) {
          return false;
        }
        if (
          label !== "all" &&
          !appLabels(app).some((x) => x.toLowerCase() === label.toLowerCase())
        ) {
          return false;
        }
        if (usage === "unused" && (app.opens || 0) > 0) return false;
        if (
          usage === "recent" &&
          !(app.lastOpenedAt && Date.now() - app.lastOpenedAt < 30 * DAY)
        ) {
          return false;
        }
        if (usage === "most" && !(app.opens || 0)) return false;
        return true;
      });

    filtered.sort((a, b) => {
      if (sort === "name") return a.app.name.localeCompare(b.app.name);
      if (sort === "added") {
        return (b.app.addedAt || 0) - (a.app.addedAt || 0) || a.app.name.localeCompare(b.app.name);
      }
      if (sort === "most") {
        return (b.app.opens || 0) - (a.app.opens || 0) || a.app.name.localeCompare(b.app.name);
      }
      const at = a.app.lastOpenedAt || a.app.addedAt || 0;
      const bt = b.app.lastOpenedAt || b.app.addedAt || 0;
      return bt - at || a.app.name.localeCompare(b.app.name);
    });
    return filtered;
  }, [state.apps, search, usage, category, label, sort]);

  const formLabelList = parseLabels(form.labels);

  const clearFilters = () => {
    setSearch("");
    setUsage("all");
    setCategory("all");
    setLabel("all");
    setSort("recent");
  };

  const openAdd = () => {
    setEditing(null);
    setForm(blankForm());
    setFormOpen(true);
  };

  const openEdit = (index: number) => {
    const app = state.apps[index];
    if (!app) return;
    setEditing(index);
    setForm({
      name: app.name,
      url: app.url,
      icon: app.icon || "↗",
      category: appCategory(app),
      labels: appLabels(app).join(", "),
      guard: !!app.guard,
    });
    setFormOpen(true);
  };

  const toggleFormLabel = (value: string) => {
    const exists = formLabelList.some((x) => x.toLowerCase() === value.toLowerCase());
    const next = exists
      ? formLabelList.filter((x) => x.toLowerCase() !== value.toLowerCase())
      : [...formLabelList, value];
    setForm((f) => ({ ...f, labels: next.join(", ") }));
  };

  const save = () => {
    const url = normalizeAppUrl(form.url);
    if (!url) {
      toast("Enter a valid http(s) URL.");
      return;
    }
    const name = form.name.trim();
    if (!name) {
      toast("Give this app a name.");
      return;
    }
    const labels = parseLabels(form.labels);
    const patch = {
      name,
      url,
      icon: form.icon.trim() || "↗",
      category: form.category.trim(),
      labels,
      guard: form.guard,
    };
    if (editing === null) {
      if (!addLaunchpadApp(patch)) {
        toast("That URL is already in your launchpad.");
        return;
      }
      toast("App added.");
    } else {
      if (!updateLaunchpadApp(editing, patch)) {
        toast("That URL is already in your launchpad.");
        return;
      }
      toast("App updated.");
    }
    rememberLaunchpadOptions([patch.category], labels);
    setFormOpen(false);
  };

  const startApp = (app: LaunchpadApp) => {
    if (needsGuard(app) && !(timer?.phase === "break" && timer.running)) {
      startBreakSnapshot(600);
      toast("Break guard on: 10 minutes, then back to focus.");
    }
    recordAppOpen(app.url);
    window.open(safeUrl(app.url), "_blank", "noopener,noreferrer");
  };

  const click = (e: MouseEvent<HTMLAnchorElement>, app: LaunchpadApp) => {
    const leave = state.set.leave || "always";
    if (focusing && leave !== "off") {
      e.preventDefault();
      setGateApp(app);
      return;
    }
    if (needsGuard(app) && !(timer?.phase === "break" && timer.running)) {
      startBreakSnapshot(600);
      toast("Break guard on: 10 minutes, then back to focus.");
    }
    recordAppOpen(app.url);
  };

  const confirmGate = () => {
    const app = gateApp;
    if (!app) return;
    setGateApp(null);
    startApp(app);
  };

  const remove = (index: number) => {
    const app = state.apps[index];
    if (!app) return;
    removeLaunchpadApp(index);
    setFormOpen(false);
    setEditing(null);
    toast(`Removed ${app.name}.`);
  };

  return (
    <>
      <div id="bgLayer" ref={bgRef} />
      <main className="lp-shell">
        <header className="lp-head">
          <a
            className="lp-back"
            href="newtab.html"
            onClick={() => skipLeaveGuard(4000)}
          >
            ← Back to your day
          </a>
          <div className="lp-head-row">
            <div>
              <div className="eyebrow">Your launchpad</div>
              <h1>Everything within reach.</h1>
              <p>
                Search, label and open the tools that matter. Your focus timer keeps running when
                you come back.
              </p>
            </div>
            <div className="lp-head-actions">
              <button className="btn brass" type="button" onClick={openAdd}>
                + Add app
              </button>
              <a
                className="btn quiet"
                href="settings.html#launchpad"
                onClick={() => skipLeaveGuard(4000)}
              >
                Bookmarks &amp; labels
              </a>
            </div>
          </div>
        </header>

        <section className="lp-toolbar" aria-label="Launchpad filters">
          <label className="lp-search">
            <span className="sr-only">Search launchpad</span>
            <input
              type="search"
              placeholder="Search apps, categories, labels…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="lp-field">
            <span>Show</span>
            <select value={usage} onChange={(e) => setUsage(e.target.value as Usage)}>
              <option value="all">All apps</option>
              <option value="recent">Recently visited</option>
              <option value="unused">Unused</option>
              <option value="most">Most used</option>
            </select>
          </label>
          <label className="lp-field">
            <span>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {options.categories.map((x) => (
                <option value={x} key={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label className="lp-field">
            <span>Label</span>
            <select value={label} onChange={(e) => setLabel(e.target.value)}>
              <option value="all">All labels</option>
              {options.labels.map((x) => (
                <option value={x} key={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label className="lp-field">
            <span>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="recent">Recent</option>
              <option value="name">Name</option>
              <option value="added">Added</option>
              <option value="most">Most used</option>
            </select>
          </label>
        </section>

        <div className="lp-toolbar-foot">
          <span>
            Showing {rows.length} of {state.apps.length} apps
          </span>
          <button className="lp-clear" type="button" onClick={clearFilters}>
            Clear filters
          </button>
        </div>

        {!state.apps.length ? (
          <div className="lp-empty">
            <div className="eyebrow">Nothing here yet</div>
            <h2>Start with one useful place.</h2>
            <p>Add an app, or import your Chrome bookmarks from Settings.</p>
            <button className="btn brass" type="button" onClick={openAdd}>
              + Add your first app
            </button>
          </div>
        ) : !rows.length ? (
          <div className="lp-empty">
            <div className="eyebrow">No matches</div>
            <h2>Nothing fits those filters.</h2>
            <p>Try a different search, category or label.</p>
            <button className="btn secondary" type="button" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        ) : (
          <section className="lp-grid" aria-label="Launchpad apps">
            {rows.map(({ app, index }) => (
              <article className="lp-card" key={appKey(app.url) + ":" + index}>
                <a
                  className="lp-card-open"
                  href={safeUrl(app.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => click(e, app)}
                  title={app.url}
                >
                  <span className="lp-icon">
                    <AppIcon url={app.url} fallback={app.icon} size={30} />
                  </span>
                  <span className="lp-card-copy">
                    <span className="lp-card-name">{app.name}</span>
                    <span className="lp-card-host">{appHost(app.url)}</span>
                  </span>
                  <span className="lp-open" aria-hidden="true">
                    ↗
                  </span>
                </a>
                <div className="lp-meta">
                  {appCategory(app) ? (
                    <span className="lp-pill">{appCategory(app)}</span>
                  ) : null}
                  {appLabels(app).map((x) => (
                    <span className="lp-label" key={x}>
                      {x}
                    </span>
                  ))}
                </div>
                <div className="lp-card-foot">
                  <span className="lp-when">{lastOpenedLabel(app)}</span>
                  <span className="lp-card-actions">
                    <button className="lp-action" type="button" onClick={() => openEdit(index)}>
                      Edit
                    </button>
                    <button
                      className="lp-action danger"
                      type="button"
                      aria-label={`Remove ${app.name}`}
                      onClick={() => remove(index)}
                    >
                      ×
                    </button>
                  </span>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} wide>
        <div className="eyebrow">{editing === null ? "NEW SHORTCUT" : "EDIT SHORTCUT"}</div>
        <h2>{editing === null ? "Add to your launchpad." : "Tune this shortcut."}</h2>
        <div className="lp-form">
          <label>
            Name
            <input
              autoFocus
              maxLength={80}
              placeholder="Notion"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label>
            URL
            <input
              maxLength={500}
              placeholder="https://example.com"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            />
          </label>
          <div className="lp-form-row">
            <label>
              Fallback icon
              <input
                maxLength={2}
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              />
            </label>
            <label>
              Category
              <input
                list="lp-categories"
                maxLength={30}
                placeholder="Work"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </label>
          </div>
          <datalist id="lp-categories">
            {options.categories.map((x) => (
              <option value={x} key={x} />
            ))}
          </datalist>
          <label>
            Labels
            <input
              maxLength={200}
              placeholder="deep-work, weekly, design"
              value={form.labels}
              onChange={(e) => setForm((f) => ({ ...f, labels: e.target.value }))}
            />
          </label>
          {options.labels.length ? (
            <div className="lp-label-picks">
              {options.labels.map((x) => {
                const active = formLabelList.some((v) => v.toLowerCase() === x.toLowerCase());
                return (
                  <button
                    className={"lp-chip" + (active ? " on" : "")}
                    type="button"
                    key={x}
                    aria-pressed={active}
                    onClick={() => toggleFormLabel(x)}
                  >
                    {x}
                  </button>
                );
              })}
            </div>
          ) : null}
          <label className="lp-check">
            <input
              type="checkbox"
              checked={form.guard}
              onChange={(e) => setForm((f) => ({ ...f, guard: e.target.checked }))}
            />{" "}
            Break guard — start a 10 minute break before opening this app
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn brass" type="button" onClick={save}>
            {editing === null ? "Add app" : "Save changes"}
          </button>
          <button className="btn quiet" type="button" onClick={() => setFormOpen(false)}>
            Cancel
          </button>
        </div>
      </Modal>

      <Modal open={!!gateApp} onClose={() => setGateApp(null)}>
        <div className="eyebrow">FOCUS CHECK</div>
        <h2>Open {gateApp?.name || "this app"}?</h2>
        <p>
          You are in a focus session{state.now ? ` on “${state.now}”` : ""}. Opening this now will
          break your flow.
        </p>
        <div className="modal-actions">
          <button className="btn primary" type="button" onClick={() => setGateApp(null)}>
            Stay focused
          </button>
          <button className="btn quiet" type="button" onClick={confirmGate}>
            Open anyway
          </button>
        </div>
      </Modal>
    </>
  );
}