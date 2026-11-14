import { FieldControl } from "../../fieldkit/FieldControl";
import { TYPES } from "../../fieldkit/types";
import type { Field } from "../../lib/types";
import { patchFieldValue } from "../../state/fieldsStore";
import { ArmButton } from "./ArmButton";

export function FieldCard({
  field,
  index,
  onMove,
  onDuplicate,
  onDelete,
  onDeleteItem,
  onEdit,
  onZoom,
}: {
  field: Field;
  index: number;
  onMove: (index: number, delta: number) => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
  onDeleteItem: (fieldIndex: number, itemIndex: number) => void;
  onEdit: (field: Field, addItem: boolean) => void;
  onZoom: (src: string) => void;
}) {
  return (
    <div className="card">
      <div className="ch">
        <div className="badge" title="Items">
          {field.items.length}
        </div>
        <div className="ct">
          <b>{field.title}</b>
          <small>
            {field.help ||
              `${field.items.length} item${field.items.length === 1 ? "" : "s"}`}
          </small>
        </div>
        <div className="acts">
          <button className="mini" type="button" title="Move earlier" onClick={() => onMove(index, -1)}>
            ↑
          </button>
          <button className="mini" type="button" title="Move later" onClick={() => onMove(index, 1)}>
            ↓
          </button>
          <button
            className="mini"
            type="button"
            title="Duplicate this field"
            onClick={() => onDuplicate(index)}
          >
            Copy
          </button>
          <button className="mini" type="button" title="Edit field and items" onClick={() => onEdit(field, false)}>
            Edit
          </button>
          <ArmButton label="Delete" title="Delete this field" onConfirm={() => onDelete(index)} />
        </div>
      </div>
      <div className="items">
        {!field.items.length ? (
          <p className="help">No items yet. Use + Add item below.</p>
        ) : (
          field.items.map((it, n) => {
            const T = TYPES[it.type] || TYPES.text;
            return (
              <div className="it" key={it.id}>
                <div className="ih">
                  <b style={it.title ? undefined : { color: "var(--muted)", fontWeight: 500 }}>
                    {it.title || T.label}
                  </b>
                  {it.required ? (
                    <span className="req" title="Required">
                      *
                    </span>
                  ) : null}
                  <small>{it.title ? T.label : ""}</small>
                  <ArmButton
                    label="×"
                    confirmLabel="Confirm?"
                    title="Delete this item"
                    onConfirm={() => onDeleteItem(index, n)}
                  />
                </div>
                {it.help ? <p className="help">{it.help}</p> : null}
                <FieldControl
                  item={it}
                  onChange={(value) => patchFieldValue(it.id, value)}
                  onZoom={onZoom}
                />
              </div>
            );
          })
        )}
      </div>
      <button className="btn quiet addit" type="button" onClick={() => onEdit(field, true)}>
        + Add item
      </button>
    </div>
  );
}