import type { BacklogItem, Priority, Task } from "./types";

export const fmt = (seconds: number): string => {
  const s = Math.max(0, Math.ceil(seconds));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
};

export const dayKey = (d: Date): string =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

export const today = (): string => dayKey(new Date());

export const safeUrl = (value: string): string => {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : "#";
  } catch {
    return "#";
  }
};

export const normUrl = (value: string): string => {
  let v = (value || "").trim();
  if (v && !/^[a-z]+:\/\//i.test(v)) v = "https://" + v;
  return safeUrl(v);
};

export const uid = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

export const maxMoves = (max: number): number => Math.min(12, Math.max(1, +max || 3));

export const parseQuick = (raw: string): { text: string; x: Partial<Task> } => {
  let text = String(raw || "").trim();
  const x: Partial<Task> = {};
  text = text
    .replace(/(^|\s)#([\w-]{1,24})/, (_m, sp: string, p: string) => {
      x.project = p;
      return sp;
    })
    .trim();
  if (/(^|\s)!(\s|$)/.test(text)) {
    x.pri = "high" as Priority;
    text = text.replace(/(^|\s)!(\s|$)/, " ").trim();
  }
  return { text, x };
};

export const mkTask = (text: string, extra?: Partial<Task>): Task => ({
  text: String(text).slice(0, 100),
  done: false,
  project: "",
  due: "",
  pri: "",
  note: "",
  ...extra,
});

export const dueDiff = (due: string): number =>
  Math.round((new Date(due + "T00:00:00").getTime() - new Date(today() + "T00:00:00").getTime()) / 864e5);

export const dueLabel = (due: string): [string, string] => {
  const n = dueDiff(due);
  if (n < 0) return ["overdue " + -n + "d", "over"];
  if (n === 0) return ["due today", "today"];
  if (n === 1) return ["due tomorrow", ""];
  if (n < 7)
    return ["due " + new Date(due + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" }), ""];
  return ["due " + new Date(due + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }), ""];
};

const PRIORITY_WEIGHT: Record<string, number> = { high: 30, med: 10 };

export const backlogScore = (item: BacklogItem): number =>
  (item.due ? dueDiff(item.due) * 10 : 500) - (PRIORITY_WEIGHT[item.pri || ""] || 0);

export const sortedBacklog = (backlog: BacklogItem[]): BacklogItem[] =>
  backlog.slice().sort((a, b) => backlogScore(a) - backlogScore(b) || (a.added || 0) - (b.added || 0));

export const newToken = (): string => {
  const a = new Uint8Array(18);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
};

export const clamp = (v: number, lo: number, hi: number, fallback: number): number =>
  Math.min(hi, Math.max(lo, +v || fallback));

export const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;