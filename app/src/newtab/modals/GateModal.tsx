import { Modal } from "../../components/ui/Modal";
import { fmt, safeUrl } from "../../lib/helpers";
import { toast } from "../../lib/toast";
import { useAnchorState } from "../../state/anchorStore";
import { useFocusActions, useFocusTick } from "../../state/focus";
import { useUi } from "../ui";

const GUARD = /youtube|instagram|tiktok|reddit|facebook|x\.com|twitter/i;

export function GateModal() {
  const ui = useUi();
  const state = useAnchorState();
  const tick = useFocusTick();
  const focus = useFocusActions();
  const app = ui.gateApp;
  const open = ui.modal === "gate" && !!app;

  const go = () => {
    if (!app) return;
    ui.close();
    if (app.guard || GUARD.test(app.url + " " + app.name)) {
      focus.startBreakNow(600);
      toast("Break guard on: 10 minutes, then back to focus.");
    }
    window.open(safeUrl(app.url), "_blank", "noopener,noreferrer");
  };

  return (
    <Modal open={open} onClose={ui.close}>
      <div className="eyebrow">FOCUS CHECK</div>
      <h2>Are you focused enough?</h2>
      <p>
        {fmt(tick.remaining)} left
        {state.now ? ` on “${state.now}”` : ""}. Opening {app?.name || "that app"} now will break
        your flow.
      </p>
      <div className="modal-actions">
        <button className="btn primary" type="button" onClick={ui.close}>
          Stay focused
        </button>
        <button className="btn quiet" type="button" onClick={go}>
          Open anyway
        </button>
      </div>
    </Modal>
  );
}