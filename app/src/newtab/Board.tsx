import { useEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { SIZES } from "../lib/defaults";
import type { LayoutEntry } from "../lib/types";
import { updateLayout } from "../state/actions";
import { useAnchorState } from "../state/anchorStore";
import { blockName, resolveLayout, widgetOf } from "./layout/model";
import { useUi } from "./ui";
import { DatesBlock } from "./blocks/DatesBlock";
import { IntentBlock } from "./blocks/IntentBlock";
import { LaterBlock } from "./blocks/LaterBlock";
import { LaunchpadBlock } from "./blocks/LaunchpadBlock";
import { MottoBanner } from "./blocks/MottoBanner";
import { TasksBlock } from "./blocks/TasksBlock";
import { TimerBlock } from "./blocks/TimerBlock";
import { VaultBlock } from "./blocks/VaultBlock";
import { WidgetBlock } from "./blocks/WidgetBlock";

interface DropTarget {
  id: string;
  after: boolean;
}

export function Board() {
  const state = useAnchorState();
  const ui = useUi();
  const entries = resolveLayout(state);
  const boardRef = useRef<HTMLElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);
  const dropRef = useRef<DropTarget | null>(null);
  const touchRef = useRef<string | null>(null);

  const setDropTarget = (next: DropTarget | null) => {
    dropRef.current = next;
    setDrop(next);
  };

  const clearDrag = () => {
    touchRef.current = null;
    setDragId(null);
    setDropTarget(null);
  };

  const moveTo = (src: string, dst: string, after: boolean) => {
    if (src === dst) return;
    const list = resolveLayout(state).slice();
    const from = list.findIndex((e) => e.id === src);
    if (from < 0) return;
    const [item] = list.splice(from, 1);
    const to = list.findIndex((e) => e.id === dst);
    if (to < 0) list.push(item);
    else list.splice(to + (after ? 1 : 0), 0, item);
    updateLayout(list);
  };

  const moveStep = (id: string, delta: number) => {
    const list = entries.slice();
    const i = list.findIndex((e) => e.id === id);
    let j = i + delta;
    while (j >= 0 && j < list.length && list[j].hidden) j += delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    updateLayout(list);
  };

  const patchEntry = (id: string, patch: Partial<LayoutEntry>) => {
    updateLayout(
      resolveLayout(state).map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  };

  const afterAt = (el: HTMLElement, x: number, y: number): boolean => {
    const r = el.getBoundingClientRect();
    const boardW = boardRef.current?.clientWidth || window.innerWidth;
    const horiz = r.width < boardW * 0.9;
    return horiz ? x > r.left + r.width / 2 : y > r.top + r.height / 2;
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!touchRef.current) return;
      e.preventDefault();
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const n = t && t.closest ? (t.closest(".blk") as HTMLElement | null) : null;
      if (!n || n.dataset.blk === touchRef.current) {
        setDropTarget(null);
        return;
      }
      setDropTarget({ id: n.dataset.blk || "", after: afterAt(n, e.clientX, e.clientY) });
    };
    const up = () => {
      const src = touchRef.current;
      if (!src) return;
      const target = dropRef.current;
      clearDrag();
      if (target && target.id && target.id !== src) moveTo(src, target.id, target.after);
    };
    const cancel = () => clearDrag();
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  });

  const dragOver = (e: DragEvent<HTMLDivElement>, id: string) => {
    if (!dragId || dragId === id) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    setDropTarget({ id, after: afterAt(e.currentTarget, e.clientX, e.clientY) });
  };

  const dropOn = (e: DragEvent<HTMLDivElement>, id: string) => {
    if (!dragId) return;
    e.preventDefault();
    const after = afterAt(e.currentTarget, e.clientX, e.clientY);
    const src = dragId;
    clearDrag();
    moveTo(src, id, after);
  };

  const startTouch = (e: ReactPointerEvent<HTMLSpanElement>, id: string) => {
    if (e.pointerType === "mouse") return;
    touchRef.current = id;
    setDragId(id);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const renderBlock = (entry: LayoutEntry) => {
    if (entry.id.startsWith("w:")) {
      const widget = state.widgets.find((w) => "w:" + w.id === entry.id);
      return widget ? <WidgetBlock widget={widget} /> : null;
    }
    switch (entry.id) {
      case "banner":
        return <MottoBanner />;
      case "dates":
        return <DatesBlock />;
      case "intent":
        return <IntentBlock />;
      case "timer":
        return <TimerBlock />;
      case "tasks":
        return <TasksBlock />;
      case "later":
        return <LaterBlock />;
      case "launchpad":
        return <LaunchpadBlock />;
      case "vault":
        return <VaultBlock />;
      default:
        return null;
    }
  };

  return (
    <main className="board" id="board" ref={boardRef}>
      {entries.map((entry) => {
        const id = entry.id;
        const widget = widgetOf(state, id);
        const known = !id.startsWith("w:") || !!widget;
        if (!known) return null;
        return (
          <div
            key={id}
            className={
              "blk sz-" +
              (entry.size || "m") +
              (dragId === id ? " dragging" : "") +
              (drop?.id === id ? (drop.after ? " dropafter" : " dropbefore") : "")
            }
            data-blk={id}
            data-h={entry.h || "auto"}
            data-st={entry.st || "card"}
            hidden={!!entry.hidden}
            onDragOver={(e) => dragOver(e, id)}
            onDragLeave={(e) => {
              if (drop?.id === id && !e.currentTarget.contains(e.relatedTarget as Node)) {
                setDropTarget(null);
              }
            }}
            onDrop={(e) => dropOn(e, id)}
          >
            {ui.editing ? (
              <div className="btools">
                <span
                  className="bhandle"
                  draggable
                  title="Drag to move"
                  onDragStart={(e) => {
                    setDragId(id);
                    if (e.dataTransfer) {
                      e.dataTransfer.setData("text/plain", id);
                      e.dataTransfer.effectAllowed = "move";
                    }
                  }}
                  onDragEnd={clearDrag}
                  onPointerDown={(e) => startTouch(e, id)}
                >
                  ⠿ {blockName(state, id)}
                </span>
                <button className="bt" type="button" title="Move earlier" onClick={() => moveStep(id, -1)}>
                  ◀
                </button>
                <button className="bt" type="button" title="Move later" onClick={() => moveStep(id, 1)}>
                  ▶
                </button>
                {SIZES.map(([k, label, title]) => (
                  <button
                    key={k}
                    className={"bt" + ((entry.size || "m") === k ? " on" : "")}
                    type="button"
                    title={title}
                    onClick={() => patchEntry(id, { size: k })}
                  >
                    {label}
                  </button>
                ))}
                <button
                  className="bt"
                  type="button"
                  title="Block options: title, height, style"
                  onClick={() => ui.openBlock(id)}
                >
                  ⚙
                </button>
                <button
                  className="bt"
                  type="button"
                  title="Hide this block (bring it back from the top bar)"
                  onClick={() => patchEntry(id, { hidden: true })}
                >
                  Hide
                </button>
              </div>
            ) : null}
            {renderBlock(entry)}
          </div>
        );
      })}
    </main>
  );
}