import type { MouseEvent } from "react";
import { AppIcon } from "../../components/AppIcon";
import { safeUrl } from "../../lib/helpers";
import { skipLeaveGuard } from "../../lib/leaveGuard";
import { toast } from "../../lib/toast";
import { recordAppOpen } from "../../state/actions";
import { useAnchorState } from "../../state/anchorStore";
import { useFocusActions, useFocusStatus } from "../../state/focus";
import { useUi } from "../ui";

const GUARD = /youtube|instagram|tiktok|reddit|facebook|x\.com|twitter/i;

export function LaunchpadBlock() {
  const state = useAnchorState();
  const status = useFocusStatus();
  const focus = useFocusActions();
  const ui = useUi();

  const click = (e: MouseEvent<HTMLAnchorElement>, app: (typeof state.apps)[number]) => {
    const focusing = status.running && status.phase === "focus";
    const leave = state.set.leave || "always";
    if (focusing && leave !== "off") {
      e.preventDefault();
      ui.openGate(app);
      return;
    }
    if ((app.guard || GUARD.test(app.url + " " + app.name)) && !(status.phase === "break" && status.running)) {
      focus.startBreakNow(600);
      toast("Break guard on: 10 minutes, then back to focus.");
    }
    recordAppOpen(app.url);
  };

  const openLaunchpad = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    skipLeaveGuard(4000);
    window.location.href = "launchpad.html";
  };

  const visible = state.apps.slice(0, 6);

  return (
    <div className="panel">
      <div className="phead">
        <div>
          <div className="eyebrow">Your launchpad</div>
          <h2 className="ptitle">Go somewhere useful.</h2>
        </div>
        <span className="section-note">{state.apps.length} apps</span>
      </div>
      <div className="app-grid" id="appGrid">
        {!state.apps.length ? (
          <p className="empty" style={{ gridColumn: "1/-1" }}>
            No shortcuts yet. Open the launchpad to add your first app.
          </p>
        ) : (
          visible.map((app, i) => (
            <a
              className="app-card"
              key={i}
              href={safeUrl(app.url)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => click(e, app)}
              title={app.url}
            >
              <span className="app-icon">
                <AppIcon url={app.url} fallback={app.icon} size={26} />
              </span>
              <span className="app-name">{app.name}</span>
              <span className="app-tag">{app.category || app.tag || "Tool"}</span>
            </a>
          ))
        )}
      </div>
      <a className="app-edit launchpad-more" id="openLaunchpad" href="launchpad.html" onClick={openLaunchpad}>
        More in Launchpad →
      </a>
    </div>
  );
}