import { useEffect, useRef, useState } from "react";
import { Toggle } from "../components/ui/Toggle";
import { mcpRuntimeKey } from "../lib/ai";
import { THEMES } from "../lib/defaults";
import { applyLook } from "../lib/look";
import { skipLeaveGuard } from "../lib/leaveGuard";
import { toast } from "../lib/toast";
import { removeWidget, setSettings, updateLayout } from "../state/actions";
import { useAnchorState } from "../state/anchorStore";
import { useBackground } from "../state/backgroundStore";
import { useFields } from "../state/fieldsStore";
import { startMcp, stopMcp } from "../state/mcpStore";
import { useUi } from "../newtab/ui";
import { CareerVaultSection } from "./CareerVaultSection";
import { LaunchpadSettings } from "./LaunchpadSettings";
import { SettingsSection } from "./SettingsSection";

export function SettingsPage() {
  const state = useAnchorState();
  const fields = useFields();
  const bg = useBackground();
  const ui = useUi();
  const bgRef = useRef<HTMLDivElement>(null);
  const [max, setMax] = useState(String(state.set.max));
  const [armed, setArmed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const resetTimer = useRef<number | undefined>(undefined);
  const mcpKey = mcpRuntimeKey(state.ai);

  useEffect(() => {
    applyLook(state.look, bg.image, bg.samples, bgRef.current);
  }, [state.look, bg]);

  useEffect(() => {
    document.title = "Settings · The Anchor Tab";
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    const reveal = () => {
      let id = window.location.hash.replace(/^#/, "");
      try {
        id = decodeURIComponent(id);
      } catch {
        // Keep the raw hash if it contains malformed escapes.
      }
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      const section = target.closest<HTMLElement>(".settings-section");
      if (section?.id) {
        const sectionId = section.id;
        setOpenSections((prev) =>
          prev[sectionId] ? prev : { ...prev, [sectionId]: true },
        );
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => target.scrollIntoView({ block: "start" }), 120);
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => {
      window.removeEventListener("hashchange", reveal);
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (state.ai.on) startMcp();
    else stopMcp();
  }, [mcpKey]);

  useEffect(() => {
    setMax(String(state.set.max));
  }, [state.set.max]);

  useEffect(() => {
    return () => window.clearTimeout(resetTimer.current);
  }, []);

  const commitMax = () => {
    const v = Math.min(12, Math.max(1, Math.round(+max) || 3));
    setMax(String(v));
    setSettings({ max: v });
  };

  const resetLayout = () => {
    if (!armed) {
      setArmed(true);
      window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setArmed(false), 3000);
      return;
    }
    setArmed(false);
    updateLayout([]);
    toast("Layout reset.");
  };

  const titleOf = (fieldId: string) =>
    fields.find((g) => g.id === fieldId)?.title || "Missing field";

  const theme = THEMES.find((t) => t.id === state.look.theme) || THEMES[0];

  const toggleSection = (id: string) =>
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  const sectionProps = (id: string) => ({
    open: !!openSections[id],
    onToggle: () => toggleSection(id),
  });

  return (
    <>
      <div id="bgLayer" ref={bgRef} />
      <div className="settings-shell">
        <header className="settings-head">
          <a
            className="settings-back"
            href="newtab.html"
            onClick={() => skipLeaveGuard()}
          >
            ← Back to your day
          </a>
          <h1>Settings</h1>
          <p>Everything that shapes your tab, in one calm place.</p>
        </header>

        <SettingsSection
          id="layout"
          eyebrow="Home layout"
          title="Make the page fit you"
          {...sectionProps("layout")}
        >
          <p>
            Move, resize, hide or add blocks and widgets. Your current home page is left exactly as
            it is until you change it here.
          </p>
          <div className="settings-actions">
            <a
              className="btn primary"
              href="newtab.html?edit=1"
              onClick={() => skipLeaveGuard()}
            >
              Customize home page
            </a>
            <button className="btn quiet" type="button" onClick={resetLayout}>
              {armed ? "Confirm reset?" : "Reset layout"}
            </button>
          </div>
        </SettingsSection>

        <SettingsSection
          id="vault"
          eyebrow="Career + Vault"
          title="Your direction, kept close"
          {...sectionProps("vault")}
        >
          <CareerVaultSection />
        </SettingsSection>

        <SettingsSection
          id="launchpad"
          eyebrow="Launchpad"
          title="Bookmarks, labels, and categories"
          {...sectionProps("launchpad")}
        >
          <LaunchpadSettings />
        </SettingsSection>

        <SettingsSection
          id="day"
          eyebrow="Day & focus"
          title="Make the day workable"
          {...sectionProps("day")}
        >

          <div className="setrow">
            <div>
              <b>Moves per day</b>
              <small>How many active tasks at once (1 to 12).</small>
            </div>
            <input
              type="number"
              id="maxMoves"
              min={1}
              max={12}
              value={max}
              onChange={(e) => setMax(e.target.value)}
              onBlur={commitMax}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
              }}
            />
          </div>

          <div className="setrow">
            <div>
              <b>Leave guard</b>
              <small>
                Ask “are you sure?” before this tab is closed or its address changes. Your browser
                writes the wording.
              </small>
            </div>
            <select
              id="prefLeave"
              value={state.set.leave || "always"}
              onChange={(e) => setSettings({ leave: e.target.value as typeof state.set.leave })}
            >
              <option value="always">Always</option>
              <option value="focus">Only while focusing</option>
              <option value="off">Off</option>
            </select>
          </div>

          <div className="setrow">
            <div>
              <b>Dim distractions while focusing</b>
              <small>Fades everything except your timer and tasks. Hover to bring a block back.</small>
            </div>
            <Toggle
              checked={state.set.dimFocus !== false}
              onChange={(v) => setSettings({ dimFocus: v })}
            />
          </div>

          <div className="setrow">
            <div>
              <b>Motion</b>
              <small>Confetti, ripples and gentle animation.</small>
            </div>
            <select
              id="prefMotion"
              value={state.set.motion || "full"}
              onChange={(e) => setSettings({ motion: e.target.value as typeof state.set.motion })}
            >
              <option value="full">Full</option>
              <option value="calm">Calm</option>
              <option value="off">Off</option>
            </select>
          </div>
        </SettingsSection>

        <SettingsSection
          id="appearance"
          eyebrow="Appearance"
          title="Look and feel"
          {...sectionProps("appearance")}
        >
          <div className="settings-theme">
            <span className="settings-theme-dots" aria-hidden="true">
              {[theme.paper, theme.surface, theme.accent, theme.brass, theme.deep].map((c) => (
                <i key={c} style={{ background: c }} />
              ))}
            </span>
            <div>
              <b>{theme.name}</b>
              <small>Themes, accent colors, backgrounds and date display.</small>
            </div>
          </div>
          <div className="settings-actions">
            <button className="btn secondary" type="button" onClick={() => ui.open("look")}>
              Open appearance
            </button>
          </div>
        </SettingsSection>

        <SettingsSection
          id="connections"
          eyebrow="Connections & data"
          title="Tools and backups"
          {...sectionProps("connections")}
        >

          <div className="setrow">
            <div>
              <b>Launchpad</b>
              <small>Bookmark import, categories, labels, and apps.</small>
            </div>
            <a className="btn secondary" href="#launchpad" style={{ textDecoration: "none" }}>
              Manage
            </a>
          </div>

          <div className="setrow">
            <div>
              <b>AI connection</b>
              <small>
                Let Claude or another AI add tasks and edit your launchpad, fields and widgets
                (MCP).
              </small>
            </div>
            <button className="btn secondary" type="button" onClick={() => ui.open("ai")}>
              Set up
            </button>
          </div>

          <div className="setrow">
            <div>
              <b>Google Drive backup</b>
              <small>Keep a copy of your tab in your own Google Drive. Restore it on another device.</small>
            </div>
            <button className="btn secondary" type="button" onClick={() => ui.open("drive")}>
              Set up
            </button>
          </div>

          <div className="setrow">
            <div>
              <b>Field Manager</b>
              <small>Create and edit the fields and widgets that appear on your tab.</small>
            </div>
            <a
              className="btn secondary"
              href="field-manager.html"
              style={{ textDecoration: "none" }}
              onClick={() => skipLeaveGuard()}
            >
              Open
            </a>
          </div>

          <div className="settings-divider">
            <b>Your widgets</b>
            <small>Widgets built from your fields. They stay on your home page.</small>
            <button className="btn secondary" type="button" onClick={() => ui.openWidget()}>
              + Add widget
            </button>
          </div>
          <div>
            {!state.widgets.length ? (
              <p className="hint">No widgets yet.</p>
            ) : (
              state.widgets.map((w) => (
                <div className="wsrow" key={w.id}>
                  <span>
                    {titleOf(w.fieldId)}
                    <small>{w.itemIds ? `${w.itemIds.length} selected items` : "All items"}</small>
                  </span>
                  {fields.some((g) => g.id === w.fieldId) ? (
                    <button className="mini" type="button" title="Edit widget" onClick={() => ui.openWidget(w.id)}>
                      Edit
                    </button>
                  ) : null}
                  <button
                    className="mini"
                    type="button"
                    title="Remove widget"
                    onClick={() => {
                      removeWidget(w.id);
                      toast("Widget removed.");
                    }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </SettingsSection>
      </div>
    </>
  );
}