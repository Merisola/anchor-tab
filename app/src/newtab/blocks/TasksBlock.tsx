import { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { burst } from "../../components/FxCanvas";
import { WORDS, maxMoves, sortedBacklog } from "../../lib/helpers";
import { toast } from "../../lib/toast";
import {
  addTask,
  clearCompleted,
  deferTask,
  pullBacklogItem,
  removeTask,
  slotsFull,
  toggleTask,
  updateTask,
} from "../../state/actions";
import { useAnchorState } from "../../state/anchorStore";
import { useFocusActions, useFocusStatus, useFocusTick } from "../../state/focus";
import { useUi } from "../ui";
import { TaskChips } from "./TaskChips";

export function TasksBlock() {
  const state = useAnchorState();
  const ui = useUi();
  const status = useFocusStatus();
  const tick = useFocusTick();
  const focus = useFocusActions();
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [pop, setPop] = useState<number | null>(null);
  const [resumeFor, setResumeFor] = useState<string | null>(null);

  const max = maxMoves(state.set.max);
  const active = state.tasks.filter((t) => !t.done).length;
  const full = active >= max;
  const nextUp = sortedBacklog(state.backlog)[0];
  const pausedProgress =
    status.phase === "focus" && !status.running && tick.remaining > 0 && tick.remaining < tick.total;

  const submit = () => {
    const res = addTask(input);
    if (res.ok) setInput("");
    else if (res.reason === "full")
      toast(`Your ${max} slots are full. Finish one, defer one, or raise the limit in Settings.`);
  };

  const commitEdit = (index: number) => {
    const value = draft.trim().slice(0, 100);
    if (value) updateTask(index, { text: value });
    setEditing(null);
  };

  const startFocus = (text: string) => {
    if (pausedProgress) {
      setResumeFor(text);
      return;
    }
    focus.startTask(text, "fresh");
  };

  const resume = (mode: "resume" | "fresh") => {
    const text = resumeFor;
    setResumeFor(null);
    if (text) focus.startTask(text, mode);
  };

  return (
    <div className="panel">
      <div className="phead">
        <div>
          <div className="eyebrow" id="ruleLabel">
            {max === 3 ? "The rule of 3" : `Your ${max} priorit${max === 1 ? "y" : "ies"}`}
          </div>
          <h2 className="ptitle" id="movesTitle">
            Today, in {WORDS[max] || max} move{max === 1 ? "" : "s"}
          </h2>
        </div>
        <span className="section-note" id="taskCount">
          {active} / {max} active
        </span>
      </div>
      <div className="task-list" id="taskList">
        {state.tasks.map((t, i) => (
          <div
            className={
              "task" +
              (pop === i ? " pop" : "") +
              (t.done ? " done" : "") +
              (state.now && state.now === t.text && !t.done ? " current" : "")
            }
            key={i}
          >
            <input
              type="checkbox"
              checked={!!t.done}
              aria-label="Complete task"
              onChange={(e) => {
                const wasDone = t.done;
                toggleTask(i);
                if (!wasDone) {
                  setPop(i);
                  burst(e.currentTarget);
                  window.setTimeout(() => setPop(null), 480);
                }
              }}
            />
            <div className="tcol">
              {editing === i ? (
                <input
                  autoFocus
                  value={draft}
                  maxLength={100}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitEdit(i)}
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
                  onDoubleClick={() => {
                    setEditing(i);
                    setDraft(t.text);
                  }}
                >
                  {t.text}
                </span>
              )}
              <TaskChips item={t} />
            </div>
            {!t.done ? (
              <button
                className="mini"
                type="button"
                title="Focus on this"
                aria-label="Focus on this task"
                onClick={() => startFocus(t.text)}
              >
                ▶
              </button>
            ) : null}
            <button
              className="mini"
              type="button"
              title="Project, due date, priority, note"
              aria-label="Task details"
              onClick={() => ui.openTask("tasks", i)}
            >
              ✎
            </button>
            {!t.done ? (
              <button
                className="mini"
                type="button"
                title="Send to backlog (frees a slot)"
                aria-label="Send to backlog"
                onClick={() => deferTask(i)}
              >
                ⤓
              </button>
            ) : null}
            <button
              className="mini"
              type="button"
              aria-label="Delete task"
              onClick={() => removeTask(i)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="add-row" id="taskForm">
        <input
          id="taskInput"
          maxLength={100}
          placeholder={full ? "Complete a task to make room" : "Add one meaningful task…"}
          autoComplete="off"
          disabled={full}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button className="btn primary" type="button" id="addBtn" disabled={full} onClick={submit}>
          Add
        </button>
      </div>
      {nextUp && !full ? (
        <div className="nextup" id="nextUp">
          <span>Room for one. Next up:</span>
          <b>{nextUp.text}</b>
          <button
            className="btn secondary sm"
            type="button"
            onClick={() => {
              if (pullBacklogItem(nextUp)) toast("Pulled into today.");
            }}
          >
            Pull in
          </button>
        </div>
      ) : null}
      <div className="limit" id="taskLimit">
        {full
          ? `Your ${max} slots are full. Finish one, or change the limit in Settings.`
          : `${max} active priorit${max === 1 ? "y" : "ies"} at a time. Finished tasks make room for the next.`}
      </div>
      <button className="app-edit" id="clearDone" type="button" onClick={clearCompleted}>
        Clear completed
      </button>

      <Modal open={!!resumeFor} onClose={() => setResumeFor(null)}>
        <div className="eyebrow">RESUME SESSION</div>
        <h2>You have time left.</h2>
        <p className="hint">
          “{resumeFor}” · {Math.ceil(tick.remaining / 60)} min left in this focus session.
        </p>
        <div className="settings-actions">
          <button className="btn brass" type="button" onClick={() => resume("resume")}>
            Resume remaining time
          </button>
          <button className="btn quiet" type="button" onClick={() => resume("fresh")}>
            Start fresh session
          </button>
        </div>
        <button className="app-edit" type="button" onClick={() => setResumeFor(null)}>
          Cancel
        </button>
      </Modal>
    </div>
  );
}