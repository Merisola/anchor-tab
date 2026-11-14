import { useEffect, useRef, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { toast } from "../../lib/toast";
import { addTask } from "../../state/actions";
import { useAnchorState } from "../../state/anchorStore";
import { useUi } from "../ui";

export function QuickTaskModal() {
  const ui = useUi();
  const state = useAnchorState();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const open = ui.modal === "quick";
  const max = Math.min(12, Math.max(1, +state.set.max || 3));

  useEffect(() => {
    if (open) {
      setText("");
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const save = () => {
    const res = addTask(text);
    if (res.ok) {
      setText("");
      ui.close();
    } else if (res.reason === "full") {
      toast(`Your ${max} slots are full. Finish one, defer one, or raise the limit in Settings.`);
    }
  };

  return (
    <Modal open={open} onClose={ui.close}>
      <div className="eyebrow">Quick task</div>
      <h2>One small thing.</h2>
      <p>Capture the next concrete action.</p>
      <input
        ref={inputRef}
        id="quickInput"
        maxLength={100}
        placeholder="What can you finish in a few minutes?"
        style={{ width: "100%", padding: 12, border: "1px solid var(--line)", borderRadius: 10 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
        }}
      />
      <div className="modal-actions">
        <button className="btn primary" type="button" onClick={save}>
          Add to today's list
        </button>
        <button className="btn quiet" type="button" onClick={ui.close}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}