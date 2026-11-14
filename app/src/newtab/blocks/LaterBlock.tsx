import { useState } from "react";
import { sortedBacklog } from "../../lib/helpers";
import { toast } from "../../lib/toast";
import {
  addBacklog,
  parkThought,
  promoteParked,
  pullBacklogItem,
  removeBacklog,
  removeParked,
  slotsFull,
  updateParked,
} from "../../state/actions";
import { useAnchorState } from "../../state/anchorStore";
import { useUi } from "../ui";
import { TaskChips } from "./TaskChips";

type LaterTab = "backlog" | "thoughts";

export function LaterBlock() {
  const state = useAnchorState();
  const ui = useUi();
  const [tab, setTab] = useState<LaterTab>("backlog");
  const [backlogInput, setBacklogInput] = useState("");
  const [thoughtInput, setThoughtInput] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  const all = sortedBacklog(state.backlog);
  const show = showAll ? all : all.slice(0, 5);
  const full = slotsFull(state);
  const thoughts = state.parked.slice().reverse();

  const submitBacklog = () => {
    if (!addBacklog(backlogInput).ok) return;
    setBacklogInput("");
  };

  const submitThought = () => {
    if (!parkThought(thoughtInput)) return;
    setThoughtInput("");
    toast("Parked. Back to work.");
  };

  const startEdit = (index: number, text: string) => {
    setEditing(index);
    setDraft(text);
  };

  const pull = (index: number, item: (typeof all)[number]) => {
    if (slotsFull(state)) {
      toast("Your slots are full. Finish or defer one first.");
      return;
    }
    if (pullBacklogItem(item)) toast("Pulled into today.");
  };

  const promote = (index: number) => {
    if (!promoteParked(index, "task")) {
      toast("Your slots are full. Finish one or defer one first.");
      return;
    }
    toast("Moved to your to-dos.");
  };

  return (
    <div className="panel later-card">
      <div className="phead">
        <div>
          <div className="eyebrow">Not now, but not forgotten</div>
          <h2 className="ptitle">Later</h2>
        </div>
        <span className="section-note">
          {state.backlog.length} queued · {state.parked.length} parked
        </span>
      </div>

      <div className="seg later-tabs" role="tablist" aria-label="Later lists">
        <button
          className={tab === "backlog" ? "on" : ""}
          type="button"
          role="tab"
          aria-selected={tab === "backlog"}
          id="laterTabBacklog"
          onClick={() => setTab("backlog")}
        >
          Backlog <span className="later-count">{state.backlog.length}</span>
        </button>
        <button
          className={tab === "thoughts" ? "on" : ""}
          type="button"
          role="tab"
          aria-selected={tab === "thoughts"}
          id="laterTabThoughts"
          onClick={() => setTab("thoughts")}
        >
          Thoughts <span className="later-count">{state.parked.length}</span>
        </button>
      </div>

      {tab === "backlog" ? (
        <div role="tabpanel" aria-labelledby="laterTabBacklog">
          <div className="add-row" style={{ marginTop: 12 }}>
            <input
              id="blInput"
              maxLength={110}
              placeholder="Set something aside…  (try #project)"
              autoComplete="off"
              value={backlogInput}
              onChange={(e) => setBacklogInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitBacklog();
                }
              }}
            />
            <button className="btn primary" id="blAdd" type="button" onClick={submitBacklog}>
              Add
            </button>
          </div>
          <div className="plist" id="blList">
            {!all.length ? (
              <p className="empty">
                Nothing waiting. Use Backlog for what matters but isn’t today’s focus.
              </p>
            ) : (
              show.map((item, k) => {
                const index = state.backlog.indexOf(item);
                return (
                  <div className={"bl-row" + (k === 0 ? " first" : "")} key={index}>
                    <div className="tcol">
                      {k === 0 ? <div className="badge">NEXT UP</div> : null}
                      <span>{item.text}</span>
                      <TaskChips item={item} />
                    </div>
                    <button
                      className="mini go"
                      type="button"
                      title={full ? "Your slots are full" : "Pull into today"}
                      disabled={full}
                      onClick={() => pull(index, item)}
                    >
                      ▲ Today
                    </button>
                    <button
                      className="mini"
                      type="button"
                      title="Details"
                      onClick={() => ui.openTask("backlog", index)}
                    >
                      ✎
                    </button>
                    <button
                      className="mini"
                      type="button"
                      aria-label="Remove from backlog"
                      onClick={() => removeBacklog(index)}
                    >
                      ×
                    </button>
                  </div>
                );
              })
            )}
          </div>
          {all.length > 5 ? (
            <button
              className="app-edit"
              id="blMore"
              type="button"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "Show fewer" : "Show all " + all.length}
            </button>
          ) : null}
        </div>
      ) : (
        <div role="tabpanel" aria-labelledby="laterTabThoughts">
          <div className="add-row" style={{ marginTop: 12 }}>
            <input
              id="parkAdd"
              maxLength={200}
              placeholder="Add a thought, idea or errand…"
              autoComplete="off"
              value={thoughtInput}
              onChange={(e) => setThoughtInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitThought();
                }
              }}
            />
            <button className="btn primary" id="parkAddBtn" type="button" onClick={submitThought}>
              Add
            </button>
          </div>
          <div className="plist" id="parkList">
            {!thoughts.length ? (
              <p className="empty">
                Nothing parked. Add a thought here, or press P on the timer mid-focus and keep going.
              </p>
            ) : (
              thoughts.map((item, reverseIndex) => {
                const index = state.parked.length - 1 - reverseIndex;
                return (
                  <div className="park-item" key={index}>
                    <div>
                      {editing === index ? (
                        <input
                          autoFocus
                          value={draft}
                          maxLength={200}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => {
                            updateParked(index, draft);
                            setEditing(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              (e.currentTarget as HTMLInputElement).blur();
                            }
                          }}
                        />
                      ) : (
                        <span
                          title="Double-click to edit"
                          onDoubleClick={() => startEdit(index, item.text)}
                        >
                          {item.text}
                        </span>
                      )}
                      <small>
                        {new Date(item.time).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </div>
                    <button className="mini" onClick={() => startEdit(index, item.text)}>
                      Edit
                    </button>
                    <button
                      className="mini"
                      onClick={() => {
                        if (promoteParked(index, "backlog")) toast("Moved to your backlog.");
                      }}
                    >
                      To backlog
                    </button>
                    <button
                      className="mini go"
                      title={full ? "Your slots are full" : "One-click move into today"}
                      onClick={() => promote(index)}
                    >
                      → Today
                    </button>
                    <button
                      className="mini"
                      aria-label="Remove parked thought"
                      onClick={() => removeParked(index)}
                    >
                      ×
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}