import { useEffect, useRef } from "react";
import { AnimatedNumber } from "../../components/ui/AnimatedNumber";
import { defaults } from "../../lib/defaults";
import { dayKey, today } from "../../lib/helpers";
import { setMotto } from "../../state/actions";
import { useAnchorState } from "../../state/anchorStore";
import { useFocusStatus } from "../../state/focus";

export function MottoBanner() {
  const state = useAnchorState();
  const status = useFocusStatus();
  const ref = useRef<HTMLDivElement>(null);
  const motion = state.set.motion === "full" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.textContent = state.motto || defaults.motto;
    }
  }, [state.motto]);

  const stats = state.stats.day === today() ? state.stats : { day: today(), n: 0, min: 0 };
  const goal = Math.max(1, state.set.g);

  let streak = 0;
  const d = new Date();
  if (!((state.hist[today()] || 0) > 0)) d.setDate(d.getDate() - 1);
  while ((state.hist[dayKey(d)] || 0) > 0) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }

  return (
    <section
      className={
        "motto" +
        (status.running && status.phase === "focus" ? " running" : "") +
        (status.running && status.phase === "break" ? " breaking" : "")
      }
      id="mottoBanner"
    >
      <div>
        <div className="eyebrow">Hi Meron.</div>
        <div
          className="motto-text"
          id="motto"
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget as HTMLDivElement).blur();
            }
          }}
          onBlur={(e) => {
            const text = e.currentTarget.textContent?.trim() || defaults.motto;
            e.currentTarget.textContent = text;
            setMotto(text);
          }}
        />
      </div>
      <div className="statwrap">
        <div className="stats">
          <div className="stat">
            <b id="stSessions">
              <AnimatedNumber value={stats.n} motion={motion} />
            </b>
            <span>sessions today</span>
          </div>
          <div className="stat">
            <b id="stMin">
              <AnimatedNumber value={stats.min} motion={motion} />
            </b>
            <span>minutes focused</span>
          </div>
          <div className="stat">
            <b id="stStreak">{streak}</b>
            <span>day streak</span>
          </div>
        </div>
        <div className="goal" title={`${stats.min} of ${goal} min daily goal`}>
          <i id="goalFill" style={{ width: Math.min(100, (stats.min / goal) * 100) + "%" }} />
        </div>
      </div>
    </section>
  );
}