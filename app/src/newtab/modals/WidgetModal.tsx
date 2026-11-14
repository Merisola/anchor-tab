import { useEffect, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { TYPES } from "../../fieldkit/types";
import { toast } from "../../lib/toast";
import type { Size } from "../../lib/types";
import { addWidget, updateWidget } from "../../state/actions";
import { useAnchorState } from "../../state/anchorStore";
import { useFields } from "../../state/fieldsStore";
import { resolveLayout } from "../layout/model";
import { useUi } from "../ui";

export function WidgetModal() {
  const ui = useUi();
  const state = useAnchorState();
  const fields = useFields();
  const open = ui.modal === "widget";
  const editing = ui.widgetId ? state.widgets.find((w) => w.id === ui.widgetId) : undefined;

  const [fieldId, setFieldId] = useState("");
  const [picked, setPicked] = useState<string[] | null>(null);
  const [size, setSize] = useState<Size>("m");
  const [cols, setCols] = useState<"1" | "2">("1");
  const [noHead, setNoHead] = useState(false);

  useEffect(() => {
    if (!open) return;
    const w = ui.widgetId ? state.widgets.find((x) => x.id === ui.widgetId) : undefined;
    const f = w ? fields.find((g) => g.id === w.fieldId) : fields[0];
    setFieldId(f?.id || "");
    setPicked(w?.itemIds ? [...w.itemIds] : null);
    const entry = w ? resolveLayout(state).find((e) => e.id === "w:" + w.id) : undefined;
    setSize(entry?.size || w?.size || "m");
    setCols(w?.cols || "1");
    setNoHead(!!w?.noHead);
    // Seed from the current widget when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ui.widgetId]);

  const field = fields.find((g) => g.id === fieldId);
  const items = field?.items || [];
  const allSelected = picked === null;
  const isChecked = (id: string) => allSelected || picked.includes(id);

  const toggleItem = (id: string) => {
    const ids = items.map((i) => i.id);
    if (picked === null) {
      setPicked(ids.filter((x) => x !== id));
      return;
    }
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    setPicked(next.length === ids.length ? null : next);
  };

  const save = () => {
    if (!field) {
      toast("Choose a field first.");
      return;
    }
    const ids = field.items.map((i) => i.id);
    const chosen = picked === null ? ids : picked.filter((id) => ids.includes(id));
    if (ids.length && !chosen.length) {
      toast("Select at least one item.");
      return;
    }
    const itemIds = chosen.length === ids.length ? null : chosen;
    const data = { fieldId: field.id, itemIds, size, cols, noHead };

    if (editing) {
      updateWidget(editing.id, data);
      toast("Widget updated.");
    } else {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const widget = { id, ...data };
      const list = resolveLayout(state);
      let idx = -1;
      list.forEach((e, i) => {
        if (e.id.startsWith("w:")) idx = i;
      });
      if (idx < 0) idx = list.findIndex((e) => e.id === "timer");
      addWidget(widget, idx + 1);
      toast("Widget added to your home page.");
    }
    ui.close();
  };

  return (
    <Modal open={open} onClose={ui.close}>
      <div className="eyebrow">Widget</div>
      <h2>{editing ? "Edit widget" : "Add widget"}</h2>
      {!fields.length ? (
        <p className="hint">
          You don’t have any fields yet.{" "}
          <a href="field-manager.html">Create one in Field Manager</a>, then come back.
        </p>
      ) : (
        <>
          <label className="cf">
            <span>Field from Field Manager</span>
            <select
              id="wField"
              value={fieldId}
              onChange={(e) => {
                setFieldId(e.target.value);
                setPicked(null);
              }}
            >
              {fields.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title} ({g.items.length})
                </option>
              ))}
            </select>
          </label>
          <span className="lbl">Items to show</span>
          <div id="wItems" className="wlist">
            {!items.length ? (
              <p className="hint">This field has no items yet. Add some in Field Manager.</p>
            ) : (
              items.map((it) => (
                <label key={it.id}>
                  <input
                    type="checkbox"
                    checked={isChecked(it.id)}
                    onChange={() => toggleItem(it.id)}
                  />
                  {(it.title || TYPES[it.type]?.label || "Item") + " · " + (TYPES[it.type]?.label || it.type)}
                </label>
              ))
            )}
          </div>
          <label className="cf">
            <span>Width</span>
            <select id="wSize" value={size} onChange={(e) => setSize(e.target.value as Size)}>
              <option value="s">Small (one third)</option>
              <option value="m">Medium (half)</option>
              <option value="l">Large (two thirds)</option>
              <option value="xl">Full width</option>
            </select>
          </label>
          <label className="cf">
            <span>Items layout</span>
            <select id="wCols" value={cols} onChange={(e) => setCols(e.target.value as "1" | "2")}>
              <option value="1">One column</option>
              <option value="2">Two columns</option>
            </select>
          </label>
          <label className="cf chk">
            <input
              type="checkbox"
              id="wHead"
              checked={!noHead}
              onChange={(e) => setNoHead(!e.target.checked)}
            />
            <span>Show title and description</span>
          </label>
        </>
      )}
      <div className="modal-actions">
        {fields.length ? (
          <button className="btn primary" type="button" onClick={save}>
            Save widget
          </button>
        ) : null}
        <button className="btn quiet" type="button" onClick={ui.close}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}