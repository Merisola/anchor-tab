import { useEffect, useRef } from "react";
import { FxCanvas, burst } from "../components/FxCanvas";
import { ToastHost } from "../components/ui/ToastHost";
import { mcpRuntimeKey } from "../lib/ai";
import { applyLook } from "../lib/look";
import { leaveGuardSkipped } from "../lib/leaveGuard";
import { toast } from "../lib/toast";
import { useAnchorState } from "../state/anchorStore";
import { useBackground } from "../state/backgroundStore";
import { reloadFields } from "../state/fieldsStore";
import { useFocusActions, useFocusStatus } from "../state/focus";
import { startMcp, stopMcp } from "../state/mcpStore";
import { Board } from "./Board";
import { BreakOverlay } from "./BreakOverlay";
import { EditBar } from "./EditBar";
import { Footer } from "./Footer";
import { Lightbox } from "./Lightbox";
import { Modals } from "./modals/Modals";
import { TopBar } from "./TopBar";
import { useUi } from "./ui";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    ["INPUT", "TEXTAREA", "BUTTON", "A", "SELECT"].includes(target.tagName) ||
    target.isContentEditable
  );
}

export function NewTab() {
  const state = useAnchorState();
  const bg = useBackground();
  const ui = useUi();
  const status = useFocusStatus();
  const focus = useFocusActions();
  const bgRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef(status);
  statusRef.current = status;
  const lastMotion = useRef(state.set.motion || "full");
  const mcpKey = mcpRuntimeKey(state.ai);

  useEffect(() => {
    applyLook(state.look, bg.image, bg.samples, bgRef.current);
  }, [state.look, bg]);

  useEffect(() => {
    document.body.classList.toggle("editing", ui.editing);
  }, [ui.editing]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("edit") === "1") {
      ui.setEditing(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [ui.setEditing]);

  useEffect(() => {
    const motion = state.set.motion || "full";
    const was = lastMotion.current;
    lastMotion.current = motion;
    document.body.classList.toggle("motion-calm", motion === "calm");
    document.body.classList.toggle("motion-off", motion === "off");
    if (
      motion === "full" &&
      was !== "full" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      burst(null, 24);
    }
  }, [state.set.motion]);

  useEffect(() => {
    let awayAt = 0;
    const onVisibility = () => {
      if (document.hidden) {
        const s = statusRef.current;
        awayAt = s.running && s.phase === "focus" ? Date.now() : 0;
        return;
      }
      if (awayAt) {
        const minutes = Math.round((Date.now() - awayAt) / 60000);
        awayAt = 0;
        if (minutes >= 1) toast(`You were away ${minutes} min during focus. Back to it.`);
      }
      void reloadFields();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const focusing =
      !!status.running && status.phase === "focus" && state.set.dimFocus !== false;
    document.body.classList.toggle("focusing", focusing);
  }, [status.running, status.phase, state.set.dimFocus]);

  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (leaveGuardSkipped()) return;
      const mode = state.set.leave || "always";
      const active =
        mode === "always" || (mode === "focus" && status.running && status.phase === "focus");
      if (!active) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [state.set.leave, status.running, status.phase]);

  useEffect(() => {
    if (state.ai.on) startMcp();
    else stopMcp();
  }, [mcpKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (status.alarmActive) return;
        ui.close();
        ui.closeCalendar();
        ui.closeLightbox();
        if (ui.editing) ui.setEditing(false);
        return;
      }
      if (
        e.code === "Space" &&
        !isTypingTarget(e.target) &&
        !ui.modal &&
        !ui.calendar &&
        !ui.lightbox &&
        !status.alarmActive
      ) {
        e.preventDefault();
        focus.toggle();
        return;
      }
      if (
        e.key.toLowerCase() === "n" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTypingTarget(e.target) &&
        !ui.modal &&
        !ui.calendar &&
        !ui.lightbox &&
        !status.alarmActive
      ) {
        const input = document.getElementById("taskInput") as HTMLInputElement | null;
        if (input && !input.disabled) {
          e.preventDefault();
          input.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ui, focus, status.alarmActive]);

  useEffect(() => {
    if ((state.set.motion || "full") !== "full") return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const button = target?.closest ? (target.closest(".btn") as HTMLElement | null) : null;
      if (!button || button.hasAttribute("disabled")) return;
      const r = button.getBoundingClientRect();
      const d = Math.max(r.width, r.height) * 2;
      const s = document.createElement("span");
      s.className = "rip";
      s.style.cssText =
        "width:" +
        d +
        "px;height:" +
        d +
        "px;left:" +
        (e.clientX - r.left - d / 2) +
        "px;top:" +
        (e.clientY - r.top - d / 2) +
        "px";
      button.append(s);
      window.setTimeout(() => s.remove(), 620);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [state.set.motion]);

  return (
    <>
      <FxCanvas enabled={(state.set.motion || "full") === "full"} />
      <div id="bgLayer" ref={bgRef} />
      <div className="shell">
        <TopBar />
        <EditBar />
        <Board />
        <Footer />
      </div>
      <BreakOverlay />
      <Lightbox />
      <Modals />
      <ToastHost />
    </>
  );
}