import { setNow } from "../../state/actions";
import { useAnchorState } from "../../state/anchorStore";
import { useFocusActions, useFocusStatus } from "../../state/focus";
import { useUi } from "../ui";

export function IntentBlock() {
  const state = useAnchorState();
  const status = useFocusStatus();
  const focus = useFocusActions();
  const ui = useUi();
  const hour = new Date().getHours();
  const greeting = (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening") + ", Meron";
  const running = status.running;
  const isFocus = status.phase === "focus";

  return (
    <div className="panel intent">
      <div>
        <div className="eyebrow" id="greet">
          {greeting}
        </div>
        <h1 id="promptTitle">
          {running ? (isFocus ? "One thing at a time." : "Rest on purpose.") : "What are we doing right now?"}
        </h1>
        <p className="sub" id="promptSub">
          {running
            ? isFocus
              ? "Protect the time you just gave yourself."
              : "A real break, with an actual ending."
            : "Pick a task, choose a session length, and press start. Your phone can wait."}
        </p>
      </div>
      <div>
        <div className="now" id="nowBox">
          <i>◆</i>
          <b id="nowText">{state.now || "No task selected. Tap ▶ on a task below."}</b>
          <button id="clearNow" hidden={!state.now} onClick={() => setNow("")}>
            clear
          </button>
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          <button
            className="btn secondary"
            id="startBreak"
            type="button"
            onClick={() => focus.startBreakNow(state.set.b * 60)}
          >
            Take a break now
          </button>
          <button className="btn quiet" id="quickTask" type="button" onClick={() => ui.open("quick")}>
            Quick task
          </button>
        </div>
      </div>
    </div>
  );
}