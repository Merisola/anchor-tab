import { useEffect, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import type { LayoutEntry } from "../../lib/types";
import { toast } from "../../lib/toast";
import { updateLayout } from "../../state/actions";
import { useAnchorState } from "../../state/anchorStore";
import { blockBaseName, resolveLayout } from "../layout/model";
import { useUi } from "../ui";

export function BlockModal() {
  const ui = useUi();
  const state = useAnchorState();
  const open = ui.modal === "block" && !!ui.blockId;
  const entries = resolveLayout(state);
  const entry = entries.find((e) => e.id === ui.blockId);
  const [name, setName] = useState("");
  const [height, setHeight] = useState("auto");
  const [style, setStyle] = useState("card");

  useEffect(() => {
    if (!open || !entry) return;
    setName(entry.name || "");
    setHeight(entry.h || "auto");
    setStyle(entry.st || "card");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ui.blockId]);

  const apply = (reset = false) => {
    if (!ui.blockId) return;
    const patch: Partial<LayoutEntry> = reset
      ? { name: undefined, h: undefined, st: undefined }
      : {
          ...(ui.blockId.startsWith("w:") ? { name: name.trim().slice(0, 40) } : {}),
          h: height as LayoutEntry["h"],
          st: style as LayoutEntry["st"],
        };
    updateLayout(entries.map((e) => (e.id === ui.blockId ? { ...e, ...patch } : e)));
    ui.close();
    toast(reset ? "Block reset." : "Block updated.");
  };

  return (
    <Modal open={open} onClose={ui.close}>
      <div className="eyebrow">Block options</div>
      <h2>{ui.blockId ? blockBaseName(state, ui.blockId) : "Block"}</h2>
      {ui.blockId?.startsWith("w:") ? (
        <label className="cf">
          <span>Custom title</span>
          <input
            type="text"
            maxLength={40}
            value={name}
            placeholder={ui.blockId ? blockBaseName(state, ui.blockId) : ""}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      ) : null}
      <label className="cf">
        <span>Height</span>
        <select value={height} onChange={(e) => setHeight(e.target.value)}>
          <option value="auto">Fit content</option>
          <option value="sm">Compact (scrolls)</option>
          <option value="md">Medium (scrolls)</option>
          <option value="lg">Tall (scrolls)</option>
        </select>
      </label>
      <label className="cf">
        <span>Card style</span>
        <select value={style} onChange={(e) => setStyle(e.target.value)}>
          <option value="card">Card</option>
          <option value="glass">Frosted glass</option>
          <option value="accent">Accent tint</option>
          <option value="flat">Flat (no card)</option>
        </select>
      </label>
      <div className="modal-actions">
        <button className="btn primary" type="button" onClick={() => apply(false)}>
          Apply
        </button>
        <button className="btn quiet" type="button" onClick={() => apply(true)}>
          Reset block
        </button>
        <button className="btn quiet" type="button" onClick={ui.close}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}