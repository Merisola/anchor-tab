import { normalizeFields, isFieldType } from "../fieldkit/types";
import { aiClient, aiClientName } from "./ai";
import { defaults } from "./defaults";
import { maxMoves, parseQuick, safeUrl, uid } from "./helpers";
import { appKey } from "./launchpad";
import type {
  AiClientId,
  AiScope,
  AnchorState,
  BacklogItem,
  Field,
  FieldConfig,
  FieldItem,
  LaunchpadApp,
  Task,
} from "./types";
import { getAnchorState, mutateAnchor } from "../state/anchorStore";
import { addBacklog, addTask, deferTask, pullBacklog, setNow } from "../state/actions";
import { fieldSummary, getFields, replaceFieldsNow } from "../state/fieldsStore";
import { resolveLayout } from "../newtab/layout/model";

export type JsonArgs = Record<string, unknown>;

const SCOPES: Array<[AiScope, string]> = [
  ["tasks", "Tasks & thoughts"],
  ["launchpad", "Launchpad"],
  ["fields", "Fields"],
  ["widgets", "Widgets & layout"],
  ["appearance", "Appearance"],
];

const NEED: Record<string, AiScope> = {
  anchor_add_task: "tasks",
  anchor_update_task: "tasks",
  anchor_park_thought: "tasks",
  anchor_set_motto: "tasks",
  anchor_launchpad: "launchpad",
  anchor_field: "fields",
  anchor_widget: "widgets",
  anchor_layout: "widgets",
  anchor_appearance: "appearance",
};

const low = (v: unknown): string => String(v ?? "").trim().toLowerCase();
const str = (v: unknown, fallback = ""): string => (v == null ? fallback : String(v));
const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const findField = (ref: string): Field => {
  const g = getFields().find((x) => x.id === ref || low(x.title) === low(ref));
  if (!g) throw new Error(`No field called "${ref}". Use anchor_list_fields.`);
  return g;
};

const cfgFromProps = (props: unknown): FieldConfig => {
  const out: FieldConfig = {};
  if (!props || typeof props !== "object" || Array.isArray(props)) return out;
  Object.entries(props as Record<string, unknown>).forEach(([key, value]) => {
    if (key === "required") return;
    if (typeof value === "string" || typeof value === "number") out[key] = value;
  });
  return out;
};

const requiredFromProps = (props: unknown): boolean | undefined => {
  if (!props || typeof props !== "object" || Array.isArray(props)) return undefined;
  const required = (props as Record<string, unknown>).required;
  return typeof required === "boolean" ? required : undefined;
};

const mkItem = (i: JsonArgs, fallback?: string): FieldItem => {
  const type = str(i.type, fallback || "text");
  if (!isFieldType(type)) throw new Error(`Unknown item type "${type}".`);
  return {
    id: uid(),
    type,
    title: str(i.title),
    help: str(i.help),
    required: requiredFromProps(i.props) ?? false,
    cfg: cfgFromProps(i.props),
    value: i.value,
  };
};

async function saveFields(list: Field[]): Promise<void> {
  const ok = await replaceFieldsNow(normalizeFields(list));
  if (!ok) throw new Error("Storage is full.");
}

function cleanApp(x: JsonArgs, base?: LaunchpadApp): LaunchpadApp {
  const url = safeUrl(str(x.url, base?.url));
  if (url === "#") throw new Error("Needs a valid http(s) URL.");
  const category = str(
    x.category !== undefined ? x.category : base?.category !== undefined ? base.category : x.tag ?? base?.tag,
    "",
  )
    .trim()
    .slice(0, 30);
  const labels = Array.isArray(x.labels)
    ? (x.labels as unknown[]).map((v) => str(v).trim()).filter(Boolean).slice(0, 8)
    : (base?.labels || []).slice(0, 8);
  return {
    name: str(x.name, base?.name || "App").slice(0, 24),
    tag: str(x.tag, base?.tag || category || "Tool").slice(0, 12),
    icon: str(x.icon, base?.icon || "◆").slice(0, 2),
    url,
    guard: typeof x.guard === "boolean" ? x.guard : !!base?.guard,
    category,
    labels,
    source: base?.source || "manual",
    addedAt: base?.addedAt || Date.now(),
    lastOpenedAt: base?.lastOpenedAt || 0,
    opens: base?.opens || 0,
  };
}

export function mcpScopes(): Array<[AiScope, string]> {
  return SCOPES;
}

export async function runMcpTool(
  tool: string,
  a: JsonArgs,
  clientId: AiClientId = "claude",
): Promise<unknown> {
  const state = getAnchorState();
  const client = aiClient(state.ai, clientId);
  const need = NEED[tool];
  if (need && !client.scopes[need]) {
    const forClient = clientId === "claude" ? "" : ` for ${aiClientName(clientId)}`;
    throw new Error(
      `"${need}" access is switched off${forClient} in Settings > AI connection.`,
    );
  }

  switch (tool) {
    case "anchor_get_state":
      return {
        motto: state.motto,
        now: state.now,
        maxActiveTasks: maxMoves(state.set.max),
        tasks: state.tasks.map((t, i) => ({ index: i, text: t.text, done: t.done, project: t.project, due: t.due, priority: t.pri, note: t.note })),
        backlog: state.backlog.map((t, i) => ({ index: i, text: t.text, project: t.project, due: t.due, priority: t.pri, note: t.note, from: t.from })),
        parked: state.parked.map((x) => x.text),
        launchpad: state.apps.map((x) => ({
          name: x.name,
          url: x.url,
          icon: x.icon,
          tag: x.tag,
          category: x.category || "",
          labels: x.labels || [],
          source: x.source || "manual",
          opens: x.opens || 0,
          lastOpenedAt: x.lastOpenedAt || 0,
        })),
        fields: getFields().map(fieldSummary),
        widgets: state.widgets.map((w, i) => ({ index: i, id: "w:" + w.id, field: getFields().find((g) => g.id === w.fieldId)?.title || "Missing field", size: (state.layout.find((e) => e.id === "w:" + w.id) || {}).size })),
        layout: resolveLayout(state).map((e) => ({ block: e.id, size: e.size, hidden: !!e.hidden, height: e.h || "auto", style: e.st || "card" })),
        look: state.look,
      };

    case "anchor_add_task": {
      const x = {
        project: str(a.project).replace(/^#/, "").slice(0, 24),
        due: /^\d{4}-\d\d-\d\d$/.test(str(a.due)) ? str(a.due) : "",
        pri: (({ high: "high", medium: "med", med: "med", low: "low" } as Record<string, Task["pri"]>)[low(a.priority)] || "") as Task["pri"],
        note: str(a.note).slice(0, 500),
      };
      if (a.backlog) {
        if (!addBacklog(str(a.text), x, "ai").ok) throw new Error("Empty text.");
        return { ok: true, where: "backlog" };
      }
      const res = addTask(str(a.text), x);
      if (!res.ok) {
        throw new Error(`Not added: empty text or all ${maxMoves(state.set.max)} active slots are full. Retry with backlog:true.`);
      }
      if (a.start) setNow(parseQuick(str(a.text)).text);
      return { ok: true, where: "today" };
    }

    case "anchor_update_task": {
      const inB = a.list === "backlog";
      const arr = inB ? getAnchorState().backlog : getAnchorState().tasks;
      let i = Number.isInteger(a.index) ? Number(a.index) : arr.findIndex((t) => low(t.text) === low(a.match));
      if (i < 0 || !arr[i]) throw new Error("Task not found. Use anchor_get_state.");
      if (a.delete) {
        mutateAnchor((cur) => {
          if (inB) return { ...cur, backlog: cur.backlog.filter((_, n) => n !== i) };
          return { ...cur, tasks: cur.tasks.filter((_, n) => n !== i), now: cur.now === cur.tasks[i]?.text ? "" : cur.now };
        });
        return { ok: true };
      }
      mutateAnchor((cur) => {
        if (inB) {
          const backlog = cur.backlog.slice();
          const t = { ...backlog[i] } as BacklogItem;
          if (a.text) t.text = str(a.text).slice(0, 100);
          if (a.project != null) t.project = str(a.project).replace(/^#/, "").slice(0, 24);
          if (a.due != null) t.due = /^\d{4}-\d\d-\d\d$/.test(str(a.due)) ? str(a.due) : "";
          if (a.priority != null) t.pri = (({ high: "high", medium: "med", med: "med", low: "low" } as Record<string, Task["pri"]>)[low(a.priority)] || "") as Task["pri"];
          if (a.note != null) t.note = str(a.note).slice(0, 500);
          backlog[i] = t;
          return { ...cur, backlog };
        }
        const tasks = cur.tasks.slice();
        const oldText = tasks[i].text;
        const t = { ...tasks[i] };
        if (a.text) t.text = str(a.text).slice(0, 100);
        if (typeof a.done === "boolean") t.done = a.done;
        if (a.project != null) t.project = str(a.project).replace(/^#/, "").slice(0, 24);
        if (a.due != null) t.due = /^\d{4}-\d\d-\d\d$/.test(str(a.due)) ? str(a.due) : "";
        if (a.priority != null) t.pri = (({ high: "high", medium: "med", med: "med", low: "low" } as Record<string, Task["pri"]>)[low(a.priority)] || "") as Task["pri"];
        if (a.note != null) t.note = str(a.note).slice(0, 500);
        tasks[i] = t;
        return { ...cur, tasks, now: cur.now === oldText && a.text ? t.text : cur.now };
      });
      if (a.move === "backlog" && !inB) deferTask(i);
      else if (a.move === "today" && inB) {
        const s = getAnchorState();
        if (s.tasks.filter((t) => !t.done).length >= maxMoves(s.set.max)) throw new Error("All active slots are full.");
        pullBacklog(i);
      }
      return { ok: true };
    }

    case "anchor_park_thought": {
      const v = str(a.text).trim().slice(0, 200);
      if (!v) throw new Error("Empty text.");
      mutateAnchor((s) => ({ ...s, parked: [...s.parked, { text: v, time: Date.now() }] }));
      return { ok: true };
    }

    case "anchor_set_motto": {
      const motto = str(a.text).trim().slice(0, 120) || defaults.motto;
      mutateAnchor((s) => ({ ...s, motto }));
      return { ok: true };
    }

    case "anchor_launchpad": {
      const action = str(a.action);
      const apps = getAnchorState().apps.slice();
      const i = apps.findIndex((x) => low(x.name) === low(a.name));
      if (action === "add") {
        const app = cleanApp(a);
        if (apps.some((x) => appKey(x.url) === appKey(app.url))) {
          throw new Error("That URL is already in the launchpad.");
        }
        apps.push(app);
      } else if (action === "replace") {
        if (!Array.isArray(a.apps) || !a.apps.length) throw new Error("Provide apps[].");
        const next = (a.apps as JsonArgs[]).map((x) => {
          const url = safeUrl(str(x.url));
          const base = apps.find((y) => safeUrl(y.url) === url);
          return cleanApp(x, base);
        });
        mutateAnchor((s) => ({ ...s, apps: next }));
        return { ok: true, count: next.length };
      } else if (i < 0) throw new Error(`No launchpad app called "${str(a.name)}".`);
      else if (action === "remove") apps.splice(i, 1);
      else if (action === "update") {
        const next = cleanApp(
          {
            name: str(a.newName || apps[i].name),
            url: a.url || apps[i].url,
            icon: a.icon || apps[i].icon,
            tag: a.tag || apps[i].tag,
            category: a.category !== undefined ? a.category : apps[i].category,
            labels: a.labels !== undefined ? a.labels : apps[i].labels,
            guard: typeof a.guard === "boolean" ? a.guard : apps[i].guard,
          },
          apps[i],
        );
        if (apps.some((x, j) => j !== i && appKey(x.url) === appKey(next.url))) {
          throw new Error("Another launchpad app already uses that URL.");
        }
        apps[i] = next;
      }
      mutateAnchor((s) => ({ ...s, apps }));
      return { ok: true, count: apps.length };
    }

    case "anchor_list_fields":
      return { types: ["text", "textarea", "select", "multi", "checkbox", "url", "question", "number", "date", "rating", "image", "clip"], fields: getFields().map(fieldSummary) };

    case "anchor_field": {
      const list: Field[] = JSON.parse(JSON.stringify(getFields())) as Field[];
      const action = str(a.action);
      if (action === "create") {
        if (!a.title) throw new Error("title required.");
        list.push({
          id: uid(),
          title: str(a.title),
          help: str(a.help),
          items: Array.isArray(a.items) ? (a.items as JsonArgs[]).map((i) => mkItem(i)) : [],
        });
      } else {
        const g = list.find((x) => x.id === a.field || low(x.title) === low(a.field));
        if (!g) throw new Error(`No field called "${str(a.field)}".`);
        if (action === "delete") list.splice(list.indexOf(g), 1);
        else if (action === "rename") {
          if (a.title) g.title = str(a.title);
          if (a.help != null) g.help = str(a.help);
        } else if (action === "add_item") g.items.push(mkItem(a));
        else {
          const it = g.items.find((x) => x.id === a.item || low(x.title) === low(a.item));
          if (!it) throw new Error(`No item "${str(a.item)}".`);
          if (action === "delete_item") g.items.splice(g.items.indexOf(it), 1);
          else {
            if (a.title != null) it.title = str(a.title);
            if (a.help != null) it.help = str(a.help);
            if (a.value !== undefined) it.value = a.value;
            const required = requiredFromProps(a.props);
            if (required !== undefined) it.required = required;
            Object.assign(it.cfg, cfgFromProps(a.props));
          }
        }
      }
      await saveFields(list);
      return { ok: true };
    }

    case "anchor_widget": {
      const action = str(a.action);
      if (action === "add") {
        const g = findField(str(a.field));
        const ids = Array.isArray(a.items) && a.items.length
          ? (a.items as string[]).map((t) => {
              const it = g.items.find((x) => x.id === t || low(x.title) === low(t));
              if (!it) throw new Error(`No item "${t}" in that field.`);
              return it.id;
            })
          : null;
        const id = uid();
        const widget = {
          id,
          fieldId: g.id,
          itemIds: ids && ids.length === g.items.length ? null : ids,
          size: (["s", "m", "l", "xl"].includes(str(a.size)) ? str(a.size) : "m") as "s" | "m" | "l" | "xl",
          cols: (str(a.cols) === "2" ? "2" : "1") as "1" | "2",
          noHead: !!a.hideHeader,
        };
        mutateAnchor((s) => {
          let idx = -1;
          s.layout.forEach((e, i) => {
            if (e.id.startsWith("w:")) idx = i;
          });
          if (idx < 0) idx = s.layout.findIndex((e) => e.id === "timer");
          const layout = s.layout.slice();
          layout.splice(idx + 1, 0, { id: "w:" + id, size: widget.size, hidden: false, ...(a.title ? { name: str(a.title).slice(0, 40) } : {}) });
          return { ...s, widgets: [...s.widgets, widget], layout };
        });
      } else {
        const state = getAnchorState();
        const i = Number.isInteger(num(a.widget)) && a.widget !== "" && a.widget != null
          ? Number(a.widget)
          : state.widgets.findIndex((w) => low(getFields().find((g) => g.id === w.fieldId)?.title) === low(a.widget) || "w:" + w.id === a.widget);
        const w = state.widgets[i];
        if (!w) throw new Error("Widget not found. Use anchor_get_state.");
        if (action === "remove") {
          mutateAnchor((s) => ({ ...s, widgets: s.widgets.filter((x) => x.id !== w.id), layout: s.layout.filter((e) => e.id !== "w:" + w.id) }));
        } else {
          mutateAnchor((s) => ({
            ...s,
            widgets: s.widgets.map((x) =>
              x.id !== w.id
                ? x
                : {
                    ...x,
                    ...(["s", "m", "l", "xl"].includes(str(a.size)) ? { size: str(a.size) as "s" | "m" | "l" | "xl" } : {}),
                    ...(a.cols ? { cols: (str(a.cols) === "2" ? "2" : "1") as "1" | "2" } : {}),
                    ...(typeof a.hideHeader === "boolean" ? { noHead: a.hideHeader } : {}),
                  },
            ),
            layout: s.layout.map((e) =>
              e.id !== "w:" + w.id
                ? e
                : {
                    ...e,
                    ...(["s", "m", "l", "xl"].includes(str(a.size)) ? { size: str(a.size) as "s" | "m" | "l" | "xl" } : {}),
                    ...(a.title != null ? { name: str(a.title).slice(0, 40) } : {}),
                  },
            ),
          }));
        }
      }
      return { ok: true };
    }

    case "anchor_layout": {
      const requested = str(a.block);
      const block = requested === "backlog" || requested === "parked" ? "later" : requested;
      const state = getAnchorState();
      const canonical = resolveLayout(state);
      const e = canonical.find((x) => x.id === block);
      if (!e) throw new Error(`Unknown block "${block}".`);
      mutateAnchor((s) => {
        let layout = resolveLayout(s).map((x) => {
          if (x.id !== block) return x;
          return {
            ...x,
            ...(a.size && ["s", "m", "l", "xl"].includes(str(a.size)) ? { size: str(a.size) as "s" | "m" | "l" | "xl" } : {}),
            ...(typeof a.hidden === "boolean" ? { hidden: a.hidden } : {}),
            ...(a.height ? { h: str(a.height) as "auto" | "sm" | "md" | "lg" } : {}),
            ...(a.style ? { st: str(a.style) as "card" | "glass" | "accent" | "flat" } : {}),
          };
        });
        if (Number.isInteger(a.position)) {
          const item = layout.find((x) => x.id === block);
          if (item) {
            layout = layout.filter((x) => x.id !== block);
            layout.splice(Math.max(0, Math.min(layout.length, Number(a.position))), 0, item);
          }
        }
        return { ...s, layout };
      });
      return { ok: true };
    }

    case "anchor_appearance": {
      mutateAnchor((s) => {
        const look = { ...s.look };
        if (a.theme) {
          if (!["sage", "navy", "rose", "ocean", "plum", "sunset", "forest", "mono", "night"].includes(str(a.theme))) throw new Error("Unknown theme.");
          look.theme = str(a.theme);
        }
        if (a.accent != null) look.accent = /^#[0-9a-f]{6}$/i.test(str(a.accent)) ? str(a.accent) : "";
        if (a.background) {
          if (!["plain", "glow", "aurora", "dots"].includes(str(a.background))) throw new Error("background must be plain, glow, aurora or dots.");
          look.bgStyle = str(a.background) as AnchorState["look"]["bgStyle"];
        }
        if (a.radius != null) look.radius = Math.max(4, Math.min(32, +a.radius || 20));
        if (a.font) look.font = a.font === "sans" ? "sans" : "serif";
        if (a.dateMode) look.dateMode = str(a.dateMode) as AnchorState["look"]["dateMode"];
        return { ...s, look };
      });
      return { ok: true };
    }
  }
  throw new Error("Unknown tool " + tool);
}