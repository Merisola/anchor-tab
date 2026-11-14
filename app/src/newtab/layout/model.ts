import { BLOCKS } from "../../lib/defaults";
import type { AnchorState, LayoutEntry, Size, Widget } from "../../lib/types";
import { getFields } from "../../state/fieldsStore";

export const widgetOf = (state: AnchorState, id: string): Widget | undefined =>
  state.widgets.find((w) => "w:" + w.id === id);

const widgetSize = (w: Widget | undefined): Size => w?.size || "m";

export function resolveLayout(state: AnchorState): LayoutEntry[] {
  const wids = state.widgets.map((w) => "w:" + w.id);
  const ids = new Set([...Object.keys(BLOCKS), ...wids]);
  const legacy: Record<string, string> = { backlog: "later", parked: "later" };
  const list: LayoutEntry[] = [];
  const seen = new Set<string>();

  (Array.isArray(state.layout) ? state.layout : []).forEach((entry) => {
    if (!entry || !entry.id) return;
    const id = legacy[entry.id] || entry.id;
    if (!ids.has(id)) return;
    if (seen.has(id)) {
      if (id === "later") {
        const index = list.findIndex((e) => e.id === "later");
        if (index >= 0 && list[index].hidden && !entry.hidden) {
          list[index] = { ...list[index], hidden: false };
        }
      }
      return;
    }
    seen.add(id);
    list.push({ ...entry, id });
  });

  const order = list.length
    ? [...Object.keys(BLOCKS), ...wids]
    : ["banner", "dates", "intent", "timer", ...wids, "tasks", "later", "launchpad", "vault"];
  order.forEach((id) => {
    if (!seen.has(id)) {
      list.push({
        id,
        size: BLOCKS[id] ? BLOCKS[id].size : widgetSize(state.widgets.find((w) => "w:" + w.id === id)),
        hidden: false,
      });
      seen.add(id);
    }
  });
  return list;
}

export function blockName(state: AnchorState, id: string): string {
  const entry = state.layout.find((e) => e.id === id);
  if (entry?.name) return entry.name;
  if (BLOCKS[id]) return BLOCKS[id].name;
  const w = widgetOf(state, id);
  if (w) {
    const field = getFields().find((g) => g.id === w.fieldId);
    return field?.title || "Widget";
  }
  return "Widget";
}

export function blockBaseName(state: AnchorState, id: string, fieldTitle?: string): string {
  if (BLOCKS[id]) return BLOCKS[id].name;
  if (widgetOf(state, id)) return fieldTitle || "Widget";
  return "Widget";
}