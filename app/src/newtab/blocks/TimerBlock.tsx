import { useEffect, useRef, useState } from "react";
import { PRESETS } from "../../lib/defaults";
import { fmt } from "../../lib/helpers";
import { alarmBurst, beep } from "../../lib/notify";
import { toast } from "../../lib/toast";
import { parkThought, setSettings } from "../../state/actions";
import { useAnchorState } from "../../state/anchorStore";
import { useFocusActions, useFocusStatus, useFocusTick } from "../../state/focus";
import { useUi } from "../ui";

const C = 2 * Math.PI * 88;

function clamp(v: string | number, lo: number, hi: number, fallback: number): number {
  const n = Number(v);
  return Math.min(hi, Math.max(lo, Number.isFinite(n) && n !== 0 ? n : fallback));
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    ["INPUT", "TEXTAREA", "BUTTON", "A", "SELECT"].includes(target.tagName) ||
    target.isContentEditable
  );
}

export function TimerBlock() {
  const state = useAnchorState();
  const status = useFocusStatus();
  const tick = useFocusTick();
  const focus = useFocusActions();
  const ui = useUi();

  const [fDraft, setFDraft] = useState(String(state.set.f));
  const [bDraft, setBDraft] = useState(String(state.set.b));
  const [lDraft, setLDraft] = useState(String(state.set.l));
  const [gDraft, setGDraft] = useState(String(state.set.g));
  const [setupOpen, setSetupOpen] = useState(false);
  const [parkOpen, setParkOpen] = useState(false);
  const [parkText, setParkText] = useState("");
  const parkRef = useRef<HTMLInputElement>(null);
  const [permission, setPermission] = useState<string>(() =>
    "Notification" in window ? Notification.permission : "unsupported",
  );

  useEffect(() => setFDraft(String(state.set.f)), [state.set.f]);
  useEffect(() => setBDraft(String(state.set.b)), [state.set.b]);
  useEffect(() => setLDraft(String(state.set.l)), [state.set.l]);
  useEffect(() => setGDraft(String(state.set.g)), [state.set.g]);

  useEffect(() => {
    if (parkOpen) parkRef.current?.focus();
  }, [parkOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "p" || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (ui.modal || ui.calendar || ui.lightbox || ui.editing || status.alarmActive) return;
      const card = document.getElementById("timerCard");
      if (!card || card.offsetParent === null) return;
      e.preventDefault();
      setParkOpen(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ui.modal, ui.calendar, ui.lightbox, ui.editing, status.alarmActive]);

  const isFocus = status.phase === "focus";
  const left = tick.remaining;
  const total = tick.total;
  const cycleNote = state.set.auto ? "auto cycle on" : "";
  const phaseLabel =
    (isFocus ? "Focus" : status.long ? "Long break" : "Break") +
    (status.running ? " in progress" : left < total ? " paused" : " ready");
  const toggleLabel = status.running
    ? "Pause"
    : left < total
      ? "Resume"
      : isFocus
        ? "Start focus"
        : "Start break";

  const commitF = () => {
    const v = clamp(fDraft, 1, 180, 25);
    setFDraft(String(v));
    focus.applyFocusSettings(v, state.set.b);
  };
  const commitB = () => {
    const v = clamp(bDraft, 1, 60, 5);
    setBDraft(String(v));
    focus.applyFocusSettings(state.set.f, v);
  };
  const commitL = () => {
    const v = clamp(lDraft, 1, 90, 15);
    setLDraft(String(v));
    setSettings({ l: v });
  };
  const commitG = () => {
    const v = clamp(gDraft, 10, 720, 120);
    setGDraft(String(v));
    setSettings({ g: v });
  };

  const submitPark = () => {
    if (!parkThought(parkText)) return;
    setParkText("");
    setParkOpen(false);
    toast("Parked for later. Back to work.");
  };

  const requestNotify = () => {
    if (!("Notification" in window)) return;
    void Notification.requestPermission().then((p) => setPermission(p));
  };

  return (
    <div className={"panel timer-card" + (!isFocus ? " breaking" : "") + (status.running ? " live" : "")} id="timerCard">
      <div className="eyebrow">
        <span>Focus engine</span>
        <span className="timer-head-right">
          <span id="cycleNote">{cycleNote}</span>
          <button
            className={"timer-gear" + (setupOpen ? " on" : "")}
            id="timerSetupBtn"
            type="button"
            aria-label="Timer settings"
            aria-expanded={setupOpen}
            aria-controls="timerSetup"
            title="Timer settings"
            onClick={() => setSetupOpen((v) => !v)}
          >
            ⚙
          </button>
        </span>
      </div>
      <div className="timer-ring">
        <svg viewBox="0 0 200 200">
          <circle className="bg" cx="100" cy="100" r="88" />
          <circle
            className="fg"
            id="ringFg"
            cx="100"
            cy="100"
            r="88"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - (total ? left / total : 0))}
          />
        </svg>
        <div className="ring-in">
          <div className="time" id="timerDisplay">
            {fmt(left)}
          </div>
          <div className="phase" id="timerLabel">
            {phaseLabel}
          </div>
          <div className="ring-task" id="ringTask" title={state.now || "No task selected"}>
            <span>{state.now ? (isFocus ? "Now" : "Back to") : "Now"}</span>
            <b>{state.now || "No task selected"}</b>
          </div>
        </div>
      </div>
      <div className="t-controls">
        <button className="btn brass" id="toggleTimer" type="button" onClick={focus.toggle}>
          {toggleLabel}
        </button>
        <button className="btn quiet" id="skipTimer" type="button" onClick={focus.skip}>
          Skip
        </button>
        <button className="btn quiet" id="resetTimer" type="button" onClick={focus.reset}>
          Reset
        </button>
      </div>

      <div className="park-strip">
        <button
          className={"park-toggle" + (parkOpen ? " on" : "")}
          id="parkThoughtBtn"
          type="button"
          aria-expanded={parkOpen}
          aria-controls="parkThoughtPop"
          onClick={() => setParkOpen((v) => !v)}
        >
          <span aria-hidden="true">＋</span> Park a thought <kbd>P</kbd>
        </button>
        {state.parked.length ? (
          <span className="park-count">{state.parked.length} waiting</span>
        ) : null}
      </div>

      {parkOpen ? (
        <div className="park-pop" id="parkThoughtPop">
          <input
            ref={parkRef}
            maxLength={200}
            autoComplete="off"
            placeholder="What can wait until later?"
            value={parkText}
            onChange={(e) => setParkText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitPark();
              }
              if (e.key === "Escape") {
                e.stopPropagation();
                setParkOpen(false);
              }
            }}
          />
          <button className="btn brass sm" type="button" onClick={submitPark}>
            Park
          </button>
          <button className="btn quiet sm" type="button" onClick={() => setParkOpen(false)}>
            Cancel
          </button>
        </div>
      ) : null}

      {setupOpen ? (
        <div className="setup" id="timerSetup">
          <div className="chips" id="chips">
            {PRESETS.map(([name, f, b]) => (
              <button
                className={"chip" + (state.set.f === f && state.set.b === b ? " on" : "")}
                type="button"
                key={name}
                onClick={() => focus.applyFocusSettings(f, b)}
              >
                {name} {f}/{b}
              </button>
            ))}
          </div>
          <div className="fields">
            <label>
              Focus (min)
              <input
                type="number"
                id="fMin"
                min={1}
                max={180}
                value={fDraft}
                onChange={(e) => setFDraft(e.target.value)}
                onBlur={commitF}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                }}
              />
            </label>
            <label>
              Break (min)
              <input
                type="number"
                id="bMin"
                min={1}
                max={60}
                value={bDraft}
                onChange={(e) => setBDraft(e.target.value)}
                onBlur={commitB}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                }}
              />
            </label>
            <label>
              Long break
              <input
                type="number"
                id="lMin"
                min={1}
                max={90}
                value={lDraft}
                onChange={(e) => setLDraft(e.target.value)}
                onBlur={commitL}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                }}
              />
            </label>
            <label>
              Daily goal
              <input
                type="number"
                id="gMin"
                min={10}
                max={720}
                value={gDraft}
                onChange={(e) => setGDraft(e.target.value)}
                onBlur={commitG}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                }}
              />
            </label>
            <label className="sw">
              <input
                type="checkbox"
                id="autoCycle"
                checked={!!state.set.auto}
                onChange={(e) => setSettings({ auto: e.target.checked })}
              />{" "}
              Auto-start next
            </label>
            <label
              className="sw"
              title="Rings loudly and waits until you choose what happens next. While on, Auto-start is paused."
            >
              <input
                type="checkbox"
                id="alarmOn"
                checked={state.set.alarm !== false}
                onChange={(e) => {
                  setSettings({ alarm: e.target.checked });
                  toast(e.target.checked ? "Loud alarm on. It waits for you." : "Loud alarm off.");
                }}
              />{" "}
              Loud alarm
            </label>
          </div>
          <div className="alert-row">
            <span id="alertState">
              {permission === "granted"
                ? "Notifications on"
                : permission === "denied"
                  ? "Blocked in browser settings"
                  : permission === "unsupported"
                    ? "Not supported here"
                    : "Notifications off"}
            </span>
            <span>
              <button
                id="testAlarm"
                type="button"
                onClick={() => {
                  alarmBurst(state.set.sound, 4);
                  toast("That is how the alarm sounds.");
                }}
              >
                Test
              </button>{" "}
              <button
                id="soundBtn"
                type="button"
                onClick={() => {
                  const next = !state.set.sound;
                  setSettings({ sound: next });
                  if (next) beep(true);
                }}
              >
                {state.set.sound ? "Sound on" : "Sound off"}
              </button>{" "}
              {permission === "default" ? (
                <button id="notifyBtn" type="button" onClick={requestNotify}>
                  Enable notifications
                </button>
              ) : null}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}