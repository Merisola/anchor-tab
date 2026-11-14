import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { fmt, today } from "../lib/helpers";
import { alarmBurst, notify, primeAudio, stopVibration } from "../lib/notify";
import { toast } from "../lib/toast";
import type { AlarmState, AnchorState, Phase, TimerState } from "../lib/types";
import { getAnchorState, mutateAnchor, updateTimerSnapshot, useAnchorState } from "./anchorStore";

interface OverlayState {
  was: Phase;
  alarm: boolean;
}

export interface FocusActions {
  toggle: () => void;
  startTask: (text: string, mode: "resume" | "fresh") => void;
  reset: () => void;
  skip: () => void;
  startBreakNow: (seconds: number) => void;
  applyFocusSettings: (f: number, b: number) => void;
  overlayGo: () => void;
  extend: (minutes: number) => void;
  stopAlarm: () => void;
  silenceAlarm: () => void;
  dismissOverlay: () => void;
  markTaskDone: () => void;
}

export interface FocusStatus {
  phase: Phase;
  long: boolean;
  running: boolean;
  overlay: OverlayState | null;
  alarmActive: boolean;
}

export interface FocusTick {
  remaining: number;
  total: number;
}

const ActionsCtx = createContext<FocusActions | null>(null);
const StatusCtx = createContext<FocusStatus | null>(null);
const TickCtx = createContext<FocusTick | null>(null);

function makeInitial(s: AnchorState): TimerState {
  const t = s.timer;
  if (t && t.total && (t.phase === "focus" || t.phase === "break")) {
    return {
      phase: t.phase,
      long: !!t.long,
      total: t.total,
      remaining: t.remaining,
      running: !!t.running,
      endAt: t.endAt || 0,
    };
  }
  const secs = s.set.f * 60;
  return { phase: "focus", long: false, total: secs, remaining: secs, running: false, endAt: 0 };
}

export function FocusProvider({ children }: { children: ReactNode }) {
  const state = useAnchorState();
  const stateRef = useRef(state);
  stateRef.current = state;

  const [timer, setTimer] = useState<TimerState>(() => makeInitial(getAnchorState()));
  const timerRef = useRef(timer);
  timerRef.current = timer;

  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const [alarmActive, setAlarmActive] = useState(false);
  const [alarmMuted, setAlarmMuted] = useState(false);
  const completingRef = useRef(false);
  const askedPermRef = useRef(false);

  const commitTimer = useCallback((next: TimerState) => {
    timerRef.current = next;
    setTimer(next);
    updateTimerSnapshot(next);
  }, []);

  const askPermOnce = useCallback(() => {
    if (
      "Notification" in window &&
      Notification.permission === "default" &&
      !askedPermRef.current
    ) {
      askedPermRef.current = true;
      Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  const complete = useCallback(() => {
    if (completingRef.current) return;
    completingRef.current = true;
    const t = timerRef.current;
    const s = stateRef.current;
    const was = t.phase;
    const next: Phase = was === "focus" ? "break" : "focus";
    let cycle = s.cycle || 0;
    let stats = { ...s.stats };
    let hist = s.hist;
    if (was === "focus") {
      if (stats.day !== today()) stats = { day: today(), n: 0, min: 0 };
      stats.n += 1;
      stats.min += Math.round(t.total / 60);
      hist = { ...hist, [today()]: stats.min };
      cycle += 1;
    }
    const long = was === "focus" && cycle % 4 === 0;
    const secs = long ? s.set.l * 60 : (next === "focus" ? s.set.f : s.set.b) * 60;
    const mins = Math.round(secs / 60);
    const msg =
      was === "focus"
        ? `Focus complete${s.now ? ": " + s.now : ""}. ${long ? "Long break" : "Break"}: ${mins} min.`
        : "Break over. Back to it.";
    notify(was === "focus" ? "Focus complete" : "Break over", msg, s.set.alarm, s.set.sound);

    const base = {
      phase: next,
      long,
      total: secs,
      remaining: secs,
      endAt: 0,
      running: false,
    };

    if (s.set.alarm) {
      const alarm: AlarmState = { was };
      mutateAnchor((cur) => ({
        ...cur,
        stats,
        hist,
        cycle,
        alarm,
        timer: base,
      }));
      timerRef.current = base;
      setTimer(base);
      setAlarmMuted(false);
      setOverlay({ was, alarm: true });
      setAlarmActive(true);
    } else if (s.set.auto) {
      const running: TimerState = { ...base, running: true, endAt: Date.now() + secs * 1000 };
      mutateAnchor((cur) => ({
        ...cur,
        stats,
        hist,
        cycle,
        alarm: null,
        timer: running,
      }));
      timerRef.current = running;
      setTimer(running);
      toast(msg);
    } else {
      mutateAnchor((cur) => ({
        ...cur,
        stats,
        hist,
        cycle,
        alarm: null,
        timer: base,
      }));
      timerRef.current = base;
      setTimer(base);
      setOverlay({ was, alarm: false });
      setAlarmActive(false);
    }
    window.setTimeout(() => {
      completingRef.current = false;
    }, 0);
  }, []);

  useEffect(() => {
    if (!timer.running) return;
    const tick = () => {
      const left = Math.max(0, (timerRef.current.endAt - Date.now()) / 1000);
      setTimer((t) => ({ ...t, remaining: left }));
      if (left <= 0) complete();
    };
    tick();
    const iv = window.setInterval(tick, 250);
    return () => window.clearInterval(iv);
  }, [timer.running, timer.endAt, timer.phase, complete]);

  useEffect(() => {
    document.title = timer.running
      ? `${fmt(timer.remaining)} · ${timer.phase === "focus" ? "Focus" : "Break"}`
      : "The Anchor Tab";
  }, [timer.running, timer.remaining, timer.phase]);

  const stopAlarm = useCallback(() => {
    setAlarmActive(false);
    setAlarmMuted(false);
    setOverlay(null);
    stopVibration();
    document.title = "The Anchor Tab";
    mutateAnchor((s) => ({ ...s, alarm: null }));
  }, []);

  useEffect(() => {
    if (!alarmActive || alarmMuted) return;
    let n = 0;
    const go = () => {
      const s = stateRef.current;
      alarmBurst(s.set.sound, n);
      n += 1;
      if (n % 8 === 0) {
        const was = overlay?.was || s.alarm?.was || "focus";
        notify(
          was === "focus" ? "Focus complete" : "Break over",
          "Still waiting. Choose what happens next.",
          true,
          s.set.sound,
        );
      }
    };
    go();
    const iv = window.setInterval(go, 3400);
    let f = 0;
    const tiv = window.setInterval(() => {
      document.title = f++ % 2 ? "⏰ TIME'S UP · act now" : "The Anchor Tab";
    }, 900);
    return () => {
      window.clearInterval(iv);
      window.clearInterval(tiv);
      stopVibration();
      document.title = "The Anchor Tab";
    };
  }, [alarmActive, alarmMuted, overlay?.was]);

  useEffect(() => {
    const s = stateRef.current;
    if (s.alarm && s.set.alarm !== false) {
      setOverlay({ was: s.alarm.was, alarm: true });
      setAlarmActive(true);
    }
  }, []);

  const start = useCallback(() => {
    const t = timerRef.current;
    primeAudio();
    const remaining = t.remaining > 0 ? t.remaining : t.total;
    const next: TimerState = {
      ...t,
      remaining,
      running: true,
      endAt: Date.now() + remaining * 1000,
    };
    commitTimer(next);
    askPermOnce();
  }, [commitTimer, askPermOnce]);

  const startTask = useCallback(
    (text: string, mode: "resume" | "fresh") => {
      const value = String(text || "").trim();
      if (!value) return;
      const t = timerRef.current;
      const s = stateRef.current;
      mutateAnchor((cur) => (cur.now === value ? cur : { ...cur, now: value }));
      if (t.running && t.phase === "focus") {
        toast(`Now focusing on “${value}”.`);
        return;
      }
      if (
        mode === "resume" &&
        t.phase === "focus" &&
        !t.running &&
        t.remaining > 0 &&
        t.remaining < t.total
      ) {
        commitTimer({ ...t, running: true, endAt: Date.now() + t.remaining * 1000 });
        primeAudio();
        askPermOnce();
        return;
      }
      const secs = s.set.f * 60;
      commitTimer({
        phase: "focus",
        long: false,
        total: secs,
        remaining: secs,
        running: true,
        endAt: Date.now() + secs * 1000,
      });
      if (t.phase === "break" && t.running) toast("Break ended. Focus started.");
      primeAudio();
      askPermOnce();
    },
    [commitTimer, askPermOnce],
  );

  const toggle = useCallback(() => {
    if (alarmActive) return;
    const t = timerRef.current;
    if (t.running) {
      const remaining = Math.max(1, Math.ceil((t.endAt - Date.now()) / 1000));
      commitTimer({ ...t, remaining, running: false });
    } else {
      start();
    }
  }, [alarmActive, commitTimer, start]);

  const reset = useCallback(() => {
    const s = stateRef.current;
    const secs = s.set.f * 60;
    commitTimer({ phase: "focus", long: false, total: secs, remaining: secs, running: false, endAt: 0 });
  }, [commitTimer]);

  const skip = useCallback(() => {
    const s = stateRef.current;
    const t = timerRef.current;
    const next: Phase = t.phase === "focus" ? "break" : "focus";
    const secs = next === "focus" ? s.set.f * 60 : s.set.b * 60;
    commitTimer({ phase: next, long: false, total: secs, remaining: secs, running: false, endAt: 0 });
  }, [commitTimer]);

  const startBreakNow = useCallback(
    (seconds: number) => {
      if (alarmActive) return;
      const secs = Math.max(1, Math.round(seconds));
      commitTimer({
        phase: "break",
        long: false,
        total: secs,
        remaining: secs,
        running: true,
        endAt: Date.now() + secs * 1000,
      });
      setOverlay(null);
      setAlarmActive(false);
    },
    [alarmActive, commitTimer],
  );

  const applyFocusSettings = useCallback(
    (f: number, b: number) => {
      mutateAnchor((s) => ({ ...s, set: { ...s.set, f, b } }));
      const t = timerRef.current;
      if (!t.running && t.remaining === t.total) {
        const secs = (t.phase === "focus" ? f : b) * 60;
        commitTimer({ ...t, total: secs, remaining: secs });
      }
    },
    [commitTimer],
  );

  const overlayGo = useCallback(() => {
    stopAlarm();
    start();
  }, [start, stopAlarm]);

  const extend = useCallback(
    (minutes: number) => {
      const was = overlay?.was || stateRef.current.alarm?.was || "break";
      stopAlarm();
      const secs = Math.max(1, minutes) * 60;
      commitTimer({
        phase: was,
        long: false,
        total: secs,
        remaining: secs,
        running: true,
        endAt: Date.now() + secs * 1000,
      });
    },
    [commitTimer, overlay?.was, stopAlarm],
  );

  const silenceAlarm = useCallback(() => {
    setAlarmMuted(true);
    stopVibration();
  }, []);

  const dismissOverlay = useCallback(() => {
    if (alarmActive) stopAlarm();
    else setOverlay(null);
  }, [alarmActive, stopAlarm]);

  const markTaskDone = useCallback(() => {
    const s = stateRef.current;
    const index = s.tasks.findIndex((t) => !t.done && t.text === s.now);
    if (index >= 0) {
      mutateAnchor((cur) => {
        const tasks = cur.tasks.slice();
        tasks[index] = { ...tasks[index], done: true };
        return { ...cur, tasks, now: "" };
      });
      toast("Task completed. Well done.");
    }
  }, []);

  const actions = useMemo<FocusActions>(
    () => ({
      toggle,
      startTask,
      reset,
      skip,
      startBreakNow,
      applyFocusSettings,
      overlayGo,
      extend,
      stopAlarm,
      silenceAlarm,
      dismissOverlay,
      markTaskDone,
    }),
    [
      toggle,
      startTask,
      reset,
      skip,
      startBreakNow,
      applyFocusSettings,
      overlayGo,
      extend,
      stopAlarm,
      silenceAlarm,
      dismissOverlay,
      markTaskDone,
    ],
  );

  const status = useMemo<FocusStatus>(
    () => ({
      phase: timer.phase,
      long: timer.long,
      running: timer.running,
      overlay,
      alarmActive,
    }),
    [timer.phase, timer.long, timer.running, overlay, alarmActive],
  );

  const tick = useMemo<FocusTick>(
    () => ({ remaining: timer.remaining, total: timer.total }),
    [timer.remaining, timer.total],
  );

  return (
    <ActionsCtx.Provider value={actions}>
      <StatusCtx.Provider value={status}>
        <TickCtx.Provider value={tick}>{children}</TickCtx.Provider>
      </StatusCtx.Provider>
    </ActionsCtx.Provider>
  );
}

export function useFocusActions(): FocusActions {
  const v = useContext(ActionsCtx);
  if (!v) throw new Error("FocusProvider missing");
  return v;
}

export function useFocusStatus(): FocusStatus {
  const v = useContext(StatusCtx);
  if (!v) throw new Error("FocusProvider missing");
  return v;
}

export function useFocusTick(): FocusTick {
  const v = useContext(TickCtx);
  if (!v) throw new Error("FocusProvider missing");
  return v;
}