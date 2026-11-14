import { useAddisDisplay } from "../../lib/ethiopian";
import { useAnchorState } from "../../state/anchorStore";

export function DatesBlock() {
  const state = useAnchorState();
  const d = useAddisDisplay(state.look.dateMode);
  return (
    <div className="panel datepanel">
      <div className="dpill">ADDIS ABABA · EAT</div>
      <div className="dgrid">
        <div>
          <div className="dbig">{d.clock}</div>
          <div className="dsub">{d.clockSub}</div>
        </div>
        <div>
          <div className="dbig">{d.localTime}</div>
          <div className="dsub">Addis local time</div>
        </div>
      </div>
    </div>
  );
}