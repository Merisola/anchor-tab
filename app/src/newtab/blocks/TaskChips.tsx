import { dueLabel } from "../../lib/helpers";
import type { BacklogItem, Task } from "../../lib/types";

export function TaskChips({ item }: { item: Task | BacklogItem }) {
  const chips: Array<{ text: string; cls: string; title?: string }> = [];
  if (item.project) chips.push({ text: "#" + item.project, cls: "" });
  if (item.due) {
    const [label, cls] = dueLabel(item.due);
    chips.push({ text: label, cls });
  }
  if (item.pri) {
    chips.push({
      text: ({ high: "High", med: "Medium", low: "Low" } as Record<string, string>)[item.pri] || "",
      cls: "p-" + item.pri,
    });
  }
  if (item.note) chips.push({ text: "📝", cls: "note", title: item.note });
  if (!chips.length) return null;
  return (
    <div className="meta">
      {chips.map((c, i) => (
        <i key={i} className={"chip2 " + c.cls} title={c.title}>
          {c.text}
        </i>
      ))}
    </div>
  );
}