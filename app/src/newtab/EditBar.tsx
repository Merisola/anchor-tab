import { useRef, useState } from "react";
import { toast } from "../lib/toast";
import { updateLayout } from "../state/actions";
import { useAnchorState } from "../state/anchorStore";
import { useFields } from "../state/fieldsStore";
import { blockName, resolveLayout } from "./layout/model";
import { useUi } from "./ui";

export function EditBar() {
  const state = useAnchorState();
  const ui = useUi();
  useFields();
  const entries = resolveLayout(state);
  const hidden = entries.filter((e) => e.hidden);
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const toggleEntry = (id: string, value: boolean) => {
    updateLayout(resolveLayout(state).map((e) => (e.id === id ? { ...e, hidden: value } : e)));
  };

  const reset = () => {
    if (!armed) {
      setArmed(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setArmed(false), 3000);
      return;
    }
    setArmed(false);
    updateLayout([]);
    toast("Layout reset.");
  };

  return (
    <div className={"editbar" + (ui.editing ? "" : "")} id="editbar" hidden={!ui.editing}>
      <div>
        <b>Customize your page</b>
        <small>
          Drag ⠿ or use ◀ ▶ to move. S, M, L and Full set the width. Hide removes a block; bring
          it back below.
        </small>
      </div>
      <div className="hchips" id="hiddenChips">
        {!hidden.length ? (
          <small>Nothing hidden.</small>
        ) : (
          hidden.map((e) => (
            <button
              key={e.id}
              type="button"
              title="Show this block again"
              onClick={() => toggleEntry(e.id, false)}
            >
              + {blockName(state, e.id)}
            </button>
          ))
        )}
      </div>
      <div className="eb-actions">
        <button className="btn secondary" id="ebAddWidget" type="button" onClick={() => ui.openWidget()}>
          + Add widget
        </button>
        <button className="btn secondary" id="ebLook" type="button" onClick={() => ui.open("look")}>
          Appearance
        </button>
        <button className="btn quiet" id="ebReset" type="button" onClick={reset}>
          {armed ? "Confirm reset?" : "Reset layout"}
        </button>
        <button className="btn primary" id="ebDone" type="button" onClick={() => ui.setEditing(false)}>
          Done
        </button>
      </div>
    </div>
  );
}