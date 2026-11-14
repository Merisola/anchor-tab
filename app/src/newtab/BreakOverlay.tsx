import { useEffect } from "react";
import { burst } from "../components/FxCanvas";
import { toast } from "../lib/toast";
import { useAnchorState } from "../state/anchorStore";
import { useFocusActions, useFocusStatus } from "../state/focus";

export function BreakOverlay() {
  const state = useAnchorState();
  const status = useFocusStatus();
  const focus = useFocusActions();
  const was = status.overlay?.was || "focus";

  useEffect(() => {
    if (status.overlay?.was === "focus") {
      const t = window.setTimeout(() => burst(null, 100), 250);
      return () => window.clearTimeout(t);
    }
  }, [status.overlay]);

  return (
    <div
      className={
        "break-overlay" +
        (status.overlay ? " show" : "") +
        (status.alarmActive ? " alarm" : "")
      }
      id="phaseOverlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ovTitle"
    >
      <div className="break-content">
        <div className="alarm-bell" aria-hidden="true">
          🔔
        </div>
        <div className="eyebrow" style={{ color: "#f3d9a8" }}>
          TIME'S UP · WAITING FOR YOU
        </div>
        <h2 id="ovTitle">{was === "focus" ? "Focus complete." : "Your break has ended."}</h2>
        <p id="ovText">
          {was === "focus"
            ? "Well done. Step away on purpose and let it land."
            : "You chose a break and you chose to come back. Keep the second promise."}
        </p>
        <div className="ov-main">
          <button className="btn brass big" id="ovGo" type="button" onClick={focus.overlayGo}>
            {was === "focus" ? "Start break" : "Start focus"}
          </button>
        </div>
        <div className="ov-row">
          <button className="btn quiet" id="ovExtend" type="button" onClick={() => focus.extend(5)}>
            + 5 min
          </button>
          <button className="btn quiet" id="ovExtend10" type="button" onClick={() => focus.extend(10)}>
            + 10 min
          </button>
          {was === "focus" && state.now ? (
            <button className="btn quiet" id="ovDone" type="button" onClick={focus.markTaskDone}>
              Mark task done
            </button>
          ) : null}
          <button className="btn quiet" id="ovClose" type="button" onClick={focus.dismissOverlay}>
            Dismiss
          </button>
        </div>
        <button
          className="ov-mute"
          id="ovMute"
          type="button"
          onClick={() => {
            focus.silenceAlarm();
            toast("Sound silenced. Choose what happens next.");
          }}
        >
          🔕 Silence sound (keeps this open)
        </button>
      </div>
    </div>
  );
}