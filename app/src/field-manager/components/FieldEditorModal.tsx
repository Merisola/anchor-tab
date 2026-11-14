import { clone, uid } from "../../lib/helpers";
import type { Field, FieldItem, FieldType } from "../../lib/types";
import { blank, CFG, defCfg, TYPES } from "../../fieldkit/types";
import { toast } from "../../lib/toast";
import { Modal } from "../../components/ui/Modal";
import { useEffect, useRef, useState } from "react";

export function newItem(type: FieldType): FieldItem {
  return { id: uid(), type, title: "", help: "", required: false, cfg: defCfg(type), value: blank(type) };
}

interface Props {
  open: boolean;
  field: Field | null;
  addItem: boolean;
  onClose: () => void;
  onSave: (field: Field) => void;
  lastType: FieldType;
  onLastType: (type: FieldType) => void;
}

export function FieldEditorModal({ open, field, addItem, onClose, onSave, lastType, onLastType }: Props) {
  const [draft, setDraft] = useState<Field>({ id: "", title: "", help: "", items: [] });
  const titleRef = useRef<HTMLInputElement>(null);
  const wasEdit = useRef(false);

  useEffect(() => {
    if (!open) return;
    const source = field
      ? (clone(field) as Field)
      : { id: "", title: "", help: "", items: [newItem("text")] };
    wasEdit.current = !!field;
    setDraft(source);
    if (field) {
      const items = field.items;
      onLastType(items.length ? items[items.length - 1].type : "text");
    } else {
      onLastType("text");
    }
    if (addItem) {
      setDraft((d) => ({ ...d, items: [...d.items, newItem(lastType)] }));
    }
    window.setTimeout(() => {
      if (addItem) {
        const titles = document.querySelectorAll<HTMLInputElement>("#itemList .i-title");
        titles[titles.length - 1]?.focus();
      } else {
        titleRef.current?.focus();
      }
    }, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const patch = (next: Partial<Field>) => setDraft((d) => ({ ...d, ...next }));

  const patchItem = (index: number, next: Partial<FieldItem>) =>
    setDraft((d) => ({
      ...d,
      items: d.items.map((it, i) => (i === index ? { ...it, ...next } : it)),
    }));

  const swap = (index: number, delta: number) => {
    const j = index + delta;
    if (j < 0 || j >= draft.items.length) return;
    setDraft((d) => {
      const items = d.items.slice();
      [items[index], items[j]] = [items[j], items[index]];
      return { ...d, items };
    });
  };

  const addDraftItem = () => {
    setDraft((d) => ({ ...d, items: [...d.items, newItem(lastType)] }));
    window.setTimeout(() => {
      const titles = document.querySelectorAll<HTMLInputElement>("#itemList .i-title");
      const el = titles[titles.length - 1];
      el?.focus();
      el?.scrollIntoView?.({ block: "nearest" });
    }, 40);
  };

  const save = () => {
    const title = draft.title.trim();
    if (!title) {
      toast("Give this field a name first.");
      titleRef.current?.focus();
      return;
    }
    onSave({
      ...draft,
      id: wasEdit.current ? draft.id : uid(),
      title,
      help: draft.help.trim(),
    });
    onClose();
    toast(wasEdit.current ? "Field updated." : "Field added.");
  };

  return (
    <Modal open={open} onClose={onClose} wide>
      <div className="eyebrow">Field</div>
      <h2>{wasEdit.current ? "Edit field" : "Add field"}</h2>
      <label className="cf">
        <span>Field name (a list, group or category)</span>
        <input
          ref={titleRef}
          type="text"
          maxLength={120}
          placeholder="e.g. Work links, Important, Weekly review"
          autoComplete="off"
          value={draft.title}
          onChange={(e) => patch({ title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
        />
      </label>
      <label className="cf">
        <span>Description (optional)</span>
        <input
          type="text"
          maxLength={200}
          autoComplete="off"
          value={draft.help}
          onChange={(e) => patch({ help: e.target.value })}
        />
      </label>
      <span className="lbl">Items in this field</span>
      <p className="hint" style={{ margin: "0 0 10px" }}>
        Add as many as you like and mix any types: questions, links, dates, numbers, ratings and
        more.
      </p>
      <div id="itemList">
        {!draft.items.length ? (
          <p className="hint">No items yet. Add your first one below.</p>
        ) : (
          draft.items.map((it, n) => (
            <div className="irow" key={it.id}>
              <div className="ihead">
                <span className="inum">{n + 1}</span>
                <select
                  className="i-type"
                  value={it.type}
                  onChange={(e) => {
                    const type = e.target.value as FieldType;
                    onLastType(type);
                    patchItem(n, { type, cfg: defCfg(type), value: blank(type) });
                  }}
                >
                  {Object.entries(TYPES).map(([key, t]) => (
                    <option key={key} value={key}>
                      {t.icon} {t.label}
                    </option>
                  ))}
                </select>
                <span className="sp" />
                <button className="mini" type="button" title="Move up" onClick={() => swap(n, -1)}>
                  ↑
                </button>
                <button className="mini" type="button" title="Move down" onClick={() => swap(n, 1)}>
                  ↓
                </button>
                <button
                  className="mini"
                  type="button"
                  title="Duplicate item"
                  onClick={() => {
                    setDraft((d) => {
                      const items = d.items.slice();
                      items.splice(n + 1, 0, { ...clone(it), id: uid() });
                      return { ...d, items };
                    });
                  }}
                >
                  ⧉
                </button>
                <button
                  className="mini"
                  type="button"
                  title="Remove item"
                  onClick={() => setDraft((d) => ({ ...d, items: d.items.filter((_, i) => i !== n) }))}
                >
                  ×
                </button>
              </div>
              <input
                type="text"
                className="i-title"
                value={it.title}
                placeholder={it.type === "question" ? "Your question" : "Title (e.g. Weekly goal)"}
                maxLength={120}
                onChange={(e) => patchItem(n, { title: e.target.value })}
              />
              <input
                type="text"
                className="i-help"
                value={it.help || ""}
                placeholder="Description (optional)"
                maxLength={200}
                onChange={(e) => patchItem(n, { help: e.target.value })}
              />
              <label className="ck">
                <input
                  type="checkbox"
                  checked={!!it.required}
                  onChange={(e) => patchItem(n, { required: e.target.checked })}
                />
                Required
              </label>
              <div className="icfg">
                {(CFG[it.type] || []).map((d) => {
                  const value = it.cfg[d.k] ?? d.d ?? "";
                  const onChange = (v: string) =>
                    patchItem(n, { cfg: { ...it.cfg, [d.k]: v } });
                  return (
                    <label className="cf" key={d.k}>
                      <span>{d.l}</span>
                      {d.t === "area" ? (
                        <textarea value={String(value)} onChange={(e) => onChange(e.target.value)} />
                      ) : d.t === "sel" ? (
                        <select value={String(value)} onChange={(e) => onChange(e.target.value)}>
                          {(d.o || []).map(([val, text]) => (
                            <option key={val} value={val}>
                              {text}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={d.t === "number" ? "number" : "text"}
                          value={String(value)}
                          onChange={(e) => onChange(e.target.value)}
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      <button className="btn quiet" type="button" onClick={addDraftItem}>
        + Add item
      </button>
      <div className="mact">
        <button className="btn quiet" type="button" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" type="button" onClick={save}>
          Save field
        </button>
      </div>
    </Modal>
  );
}