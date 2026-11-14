import { FieldControl } from "../../fieldkit/FieldControl";
import { TYPES } from "../../fieldkit/types";
import type { Widget } from "../../lib/types";
import { useAnchorState } from "../../state/anchorStore";
import { patchFieldValue, useFields } from "../../state/fieldsStore";
import { removeWidget } from "../../state/actions";
import { useUi } from "../ui";

export function WidgetBlock({ widget }: { widget: Widget }) {
  const state = useAnchorState();
  const fields = useFields();
  const ui = useUi();
  const field = fields.find((g) => g.id === widget.fieldId);
  const entry = state.layout.find((e) => e.id === "w:" + widget.id);
  const title = widget.noHead ? "" : entry?.name || field?.title || "Missing field";

  return (
    <div className="wcard">
      <div className="wh">
        <div className="wt">
          <b>{title}</b>
          <small>
            {widget.noHead
              ? ""
              : field
                ? field.help || ""
                : "This field was deleted in Field Manager."}
          </small>
        </div>
        <div className="wa">
          {field ? (
            <button
              className="mini"
              type="button"
              title="Choose items and width"
              onClick={() => ui.openWidget(widget.id)}
            >
              Edit
            </button>
          ) : null}
          <button
            className="mini"
            type="button"
            title="Remove widget"
            onClick={() => {
              removeWidget(widget.id);
            }}
          >
            ×
          </button>
        </div>
      </div>
      {field ? (
        <div className={"wbody" + (widget.cols === "2" ? " cols2" : "")}>
          {field.items.filter((it) => !widget.itemIds || widget.itemIds.includes(it.id)).length === 0 ? (
            <p className="help">Nothing to show yet. Add items in Field Manager.</p>
          ) : (
            field.items
              .filter((it) => !widget.itemIds || widget.itemIds.includes(it.id))
              .map((it) => {
                const type = TYPES[it.type] || TYPES.text;
                return (
                  <div className="wit" key={it.id}>
                    <div className="wih">
                      <b style={it.title ? undefined : { color: "var(--muted)", fontWeight: 500 }}>
                        {it.title || type.label}
                      </b>
                      {it.required ? (
                        <span className="req" title="Required">
                          *
                        </span>
                      ) : null}
                      <small>{it.title ? type.label : ""}</small>
                    </div>
                    {it.help ? <p className="help">{it.help}</p> : null}
                    <FieldControl
                      item={it}
                      onChange={(value) => patchFieldValue(it.id, value)}
                      onZoom={ui.openLightbox}
                    />
                  </div>
                );
              })
          )}
        </div>
      ) : null}
    </div>
  );
}