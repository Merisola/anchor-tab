import { useEffect, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { dayKey } from "../../lib/helpers";
import { toast } from "../../lib/toast";
import type { Priority } from "../../lib/types";
import { pullBacklog, removeBacklog, removeTask, setNow, slotsFull, updateBacklog, updateTask, deferTask } from "../../state/actions";
import { useAnchorState } from "../../state/anchorStore";
import { useUi } from "../ui";

const PRIORITIES: Array<[Priority, string]> = [
  ["", "None"],
  ["low", "Low"],
  ["med", "Medium"],
  ["high", "High"],
];

export function TaskModal() {
  const ui = useUi();
  const state = useAnchorState();
  const ref = ui.taskRef;
  const list = ref?.list || "tasks";
  const index = ref?.index ?? -1;
  const item = list === "tasks" ? state.tasks[index] : state.backlog[index];
  const open = ui.modal === "task" && !!item;

  const [text, setText] = useState("");
  const [project, setProject] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<Priority>("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open || !item) return;
    setText(item.text);
    setProject(item.project || "");
    setDue(item.due || "");
    setPriority(item.pri || "");
    setNote(item.note || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ref?.list, ref?.index]);

  const projects = Array.from(
    new Set([...state.tasks, ...state.backlog].map((t) => t.project).filter(Boolean)),
  ) as string[];

  const quickDay = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return dayKey(d);
  };

  const applyLocal = (): boolean => {
    const value = text.trim().slice(0, 100);
    if (!value) {
      toast("A task needs some text.");
      return false;
    }
    const patch = {
      text: value,
      project: project.trim().replace(/^#/, "").slice(0, 24),
      due: due || "",
      note: note.trim().slice(0, 500),
      pri: priority,
    };
    if (list === "tasks") updateTask(index, patch);
    else updateBacklog(index, patch);
    return true;
  };

  const save = () => {
    if (!applyLocal()) return;
    ui.close();
  };

  const move = () => {
    if (!applyLocal()) return;
    if (list === "tasks") {
      deferTask(index);
    } else if (slotsFull(state)) {
      toast("Your slots are full. Finish or defer one first.");
      return;
    } else {
      pullBacklog(index);
    }
    ui.close();
  };

  const del = () => {
    if (list === "tasks") {
      if (state.now === state.tasks[index]?.text) setNow("");
      removeTask(index);
    } else {
      removeBacklog(index);
    }
    ui.close();
  };

  return (
    <Modal open={open} onClose={ui.close}>
      <div className="eyebrow">{list === "tasks" ? "Today · task details" : "Backlog · task details"}</div>
      <h2>Shape this task.</h2>
      <label className="cf">
        <span>What</span>
        <input type="text" maxLength={100} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <label className="cf">
        <span>Project</span>
        <input
          type="text"
          maxLength={24}
          list="projList"
          placeholder="Optional"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        />
        <datalist id="projList">
          {projects.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </label>
      <span className="lbl">Due</span>
      <div className="seg">
        {[
          ["Today", 0],
          ["Tomorrow", 1],
          ["Next week", 7],
        ].map(([label, n]) => (
          <button key={label as string} type="button" onClick={() => setDue(quickDay(n as number))}>
            {label}
          </button>
        ))}
        <button type="button" onClick={() => setDue("")}>
          No date
        </button>
      </div>
      <input
        type="date"
        value={due}
        onChange={(e) => setDue(e.target.value)}
        style={{
          marginTop: 8,
          width: "100%",
          border: "1px solid var(--line)",
          borderRadius: 10,
          padding: 10,
          background: "var(--field)",
          color: "var(--ink)",
        }}
      />
      <span className="lbl">Priority</span>
      <div className="seg">
        {PRIORITIES.map(([key, label]) => (
          <button
            key={key || "none"}
            type="button"
            className={priority === key ? "on" : ""}
            onClick={() => setPriority(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="cf">
        <span>Note</span>
        <textarea
          maxLength={500}
          rows={3}
          placeholder="Context, next step, who is waiting…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{
            width: "100%",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: 10,
            background: "var(--field)",
            color: "var(--ink)",
            resize: "vertical",
          }}
        />
      </label>
      <div className="modal-actions">
        <button className="btn primary" type="button" onClick={save}>
          Save
        </button>
        <button
          className="btn secondary"
          type="button"
          disabled={list === "backlog" && slotsFull(state)}
          onClick={move}
        >
          {list === "tasks" ? "Send to backlog" : "Pull into today"}
        </button>
        <button className="btn quiet" type="button" onClick={del}>
          Delete
        </button>
      </div>
    </Modal>
  );
}