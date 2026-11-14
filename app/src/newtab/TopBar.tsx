import { useAddisDisplay } from "../lib/ethiopian";
import { skipLeaveGuard } from "../lib/leaveGuard";
import { useAnchorState } from "../state/anchorStore";
import { useUi } from "./ui";

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.22.6.79 1 1.55 1H21a2 2 0 1 1 0 4h-.09c-.76 0-1.33.4-1.55 1Z" />
    </svg>
  );
}

export function TopBar() {
  const state = useAnchorState();
  const ui = useUi();
  const d = useAddisDisplay(state.look.dateMode);

  const ethButton = (
    <button
      className="top-date"
      type="button"
      key="eth"
      title="Open the Ethiopian calendar"
      aria-label={`Open the Ethiopian calendar. ${d.ethFull}`}
      onClick={() => ui.openCalendar("eth")}
    >
      <span className="top-date-kicker">Ethiopian</span>
      <span className="top-date-value">{d.ethFull}</span>
    </button>
  );

  const gregButton = (
    <button
      className="top-date"
      type="button"
      key="greg"
      title="Open the Gregorian calendar"
      aria-label={`Open the Gregorian calendar. ${d.gregFull}`}
      onClick={() => ui.openCalendar("greg")}
    >
      <span className="top-date-kicker">Gregorian</span>
      <span className="top-date-value">{d.gregFull}</span>
    </button>
  );

  return (
    <header className="topline">
      <div className="brand">
        <span className="brand-mark">⌖</span> the anchor tab
      </div>
      <div className="top-dates">
        {state.look.dateMode === "greg" ? [gregButton, ethButton] : [ethButton, gregButton]}
        <div className="top-clock" title="Ethiopian clock and Addis local time">
          <span className="top-clock-kicker">Addis</span>
          <span className="top-clock-value">
            {d.clock} <em>{d.localTime}</em>
          </span>
        </div>
      </div>
      <a
        className="gear-btn"
        href="settings.html"
        aria-label="Settings"
        title="Settings"
        onClick={() => skipLeaveGuard()}
      >
        <SettingsIcon />
      </a>
    </header>
  );
}