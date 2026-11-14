import { useEffect, useState } from "react";
import { clone, uid } from "../lib/helpers";
import type { Field, FieldType } from "../lib/types";
import { replaceFieldsNow, useFields } from "../state/fieldsStore";
import { toast } from "../lib/toast";
import { ToastHost } from "../components/ui/ToastHost";
import { FieldCard } from "./components/FieldCard";
import { FieldEditorModal } from "./components/FieldEditorModal";

export function FieldManagerApp() {
  const fields = useFields();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Field | null>(null);
  const [addItem, setAddItem] = useState(false);
  const [lastType, setLastType] = useState<FieldType>("text");
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditorOpen(false);
        setZoom(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const openAdd = () => {
    setEditing(null);
    setAddItem(false);
    setEditorOpen(true);
  };

  const openEdit = (field: Field, add: boolean) => {
    setEditing(field ? (clone(field) as Field) : null);
    setAddItem(add);
    setEditorOpen(true);
  };

  const move = (index: number, delta: number) => {
    const j = index + delta;
    if (j < 0 || j >= fields.length) return;
    const next = fields.slice();
    [next[index], next[j]] = [next[j], next[index]];
    void replaceFieldsNow(next);
  };

  const duplicate = (index: number) => {
    const copy = clone(fields[index]) as Field;
    copy.id = uid();
    copy.title += " (copy)";
    copy.items = copy.items.map((it) => ({ ...it, id: uid() }));
    const next = fields.slice();
    next.splice(index + 1, 0, copy);
    void replaceFieldsNow(next);
  };

  const remove = (index: number) => {
    void replaceFieldsNow(fields.filter((_, i) => i !== index));
    toast("Field deleted.");
  };

  const removeItem = (fieldIndex: number, itemIndex: number) => {
    const next = fields.map((g, i) =>
      i === fieldIndex ? { ...g, items: g.items.filter((_, n) => n !== itemIndex) } : g,
    );
    void replaceFieldsNow(next);
  };

  const saveField = (field: Field) => {
    const exists = fields.some((g) => g.id === field.id);
    const next = exists ? fields.map((g) => (g.id === field.id ? field : g)) : [...fields, field];
    void replaceFieldsNow(next);
  };

  return (
    <>
      <div className="shell">
        <header className="topline">
          <div className="brand">
            <span className="brand-mark">⌖</span> field manager
          </div>
          <a className="back" href="newtab.html">
            ← Back to Anchor Tab
          </a>
        </header>
        <div className="head">
          <div>
            <div className="eyebrow" id="count">
              {fields.length} field{fields.length === 1 ? "" : "s"}
            </div>
            <h1>Build your own fields.</h1>
            <p className="sub">
              Each field is a container. Make a list of links, a set of questions, a group of
              ratings, or mix any types together. Fill things in right on the card; everything saves
              automatically on this device.
            </p>
          </div>
          <button className="btn primary" type="button" onClick={openAdd}>
            + Add Field
          </button>
        </div>
        <section className="grid" id="grid">
          {!fields.length ? (
            <div className="empty">
              <h3>Build your first field</h3>
              <p>
                Create a list of links, a set of questions, or a mix of anything. Each field can
                hold as many items as you want.
              </p>
              <button className="btn primary" type="button" onClick={openAdd}>
                + Add Field
              </button>
            </div>
          ) : (
            fields.map((g, i) => (
              <FieldCard
                key={g.id}
                field={g}
                index={i}
                onMove={move}
                onDuplicate={duplicate}
                onDelete={remove}
                onDeleteItem={removeItem}
                onEdit={openEdit}
                onZoom={setZoom}
              />
            ))
          )}
        </section>
      </div>

      <FieldEditorModal
        open={editorOpen}
        field={editing}
        addItem={addItem}
        lastType={lastType}
        onLastType={setLastType}
        onClose={() => setEditorOpen(false)}
        onSave={saveField}
      />

      <div
        className={"lightbox" + (zoom ? " show" : "")}
        id="lightbox"
        onClick={() => setZoom(null)}
      >
        {zoom ? <img src={zoom} alt="Full size image" /> : null}
      </div>

      <ToastHost />
    </>
  );
}