import { FIELD_TYPES } from "../lib/defaults";
import type { Field, FieldConfig, FieldItem, FieldType } from "../lib/types";

export const TYPES = FIELD_TYPES;

export interface CfgField {
  t: "text" | "number" | "area" | "sel";
  k: string;
  l: string;
  d?: string | number;
  o?: Array<[string, string]>;
}

const OPT: CfgField = { t: "area", k: "options", l: "Options (one per line)", d: "Option 1\nOption 2\nOption 3" };
const PH: CfgField = { t: "text", k: "placeholder", l: "Placeholder text" };

export const CFG: Record<FieldType, CfgField[]> = {
  text: [PH, { t: "number", k: "max", l: "Max characters (optional)" }],
  textarea: [PH, { t: "number", k: "rows", l: "Visible rows", d: 4 }],
  select: [OPT, { t: "text", k: "placeholder", l: "Placeholder", d: "Choose…" }],
  multi: [OPT],
  checkbox: [{ t: "text", k: "label", l: "Checkbox label", d: "Done" }],
  url: [{ t: "text", k: "placeholder", l: "Placeholder text", d: "https://…" }],
  question: [{ t: "sel", k: "style", l: "Answer style", o: [["short", "Short answer"], ["long", "Long answer"]], d: "long" }],
  number: [
    { t: "number", k: "min", l: "Minimum (optional)" },
    { t: "number", k: "max", l: "Maximum (optional)" },
    { t: "number", k: "step", l: "Step", d: 1 },
    { t: "text", k: "unit", l: "Unit label, e.g. hrs or %" },
  ],
  date: [],
  rating: [{ t: "number", k: "max", l: "Number of stars (3 to 10)", d: 5 }],
  image: [{ t: "number", k: "max", l: "Max width in px (smaller saves space)", d: 1000 }],
  clip: [
    { t: "number", k: "rows", l: "Visible rows", d: 3 },
    { t: "sel", k: "style", l: "Text style", o: [["plain", "Plain"], ["mono", "Monospace (code)"]], d: "plain" },
  ],
};

export const isFieldType = (t: string): t is FieldType => Object.prototype.hasOwnProperty.call(TYPES, t);

export const optsOf = (cfg: FieldConfig): string[] =>
  String(cfg.options || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

export const blank = (t: FieldType): unknown =>
  t === "checkbox" ? false : t === "multi" ? [] : t === "rating" ? 0 : "";

export const defCfg = (t: FieldType): FieldConfig => {
  const c: FieldConfig = {};
  (CFG[t] || []).forEach((d) => {
    if (d.d !== undefined) c[d.k] = d.d;
  });
  return c;
};

const uid = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function normalizeFields(arr: unknown): Field[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(Boolean)
    .map((f: unknown) => {
      const rec = f as Record<string, unknown>;
      if (rec.items) return rec as unknown as Field;
      if (rec.type) {
        return {
          id: uid(),
          title: String(rec.title || "Untitled"),
          help: String(rec.help || ""),
          items: [
            {
              id: (String(rec.id || uid()) + "-i") as string,
              type: rec.type as FieldType,
              title: "",
              help: "",
              required: !!rec.required,
              cfg: (rec.cfg as FieldConfig) || {},
              value: rec.value ?? blank(rec.type as FieldType),
            },
          ],
        };
      }
      return null;
    })
    .filter((x): x is Field => !!x)
    .map((g) => ({
      ...g,
      items: (Array.isArray(g.items) ? g.items : []).filter(
        (i): i is FieldItem => !!i && isFieldType(i.type),
      ),
    }));
}