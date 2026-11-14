import { defaults } from "./defaults";
import { today } from "./helpers";
import { skipLeaveGuard } from "./leaveGuard";
import { toast } from "./toast";
import type { AnchorState } from "./types";
import { flushAnchorState, replaceAnchorState } from "../state/anchorStore";

export function exportBackup(state: AnchorState): void {
  const b = new Blob([JSON.stringify(state, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = "anchor-backup-" + today() + ".json";
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importBackup(file: File | null | undefined): Promise<boolean> {
  if (!file) return false;
  try {
    const d = JSON.parse(await file.text()) as Record<string, unknown>;
    if (!d || !Array.isArray(d.tasks)) throw new Error("bad");
    const merged = {
      ...defaults,
      ...d,
      set: { ...defaults.set, ...((d.set as object) || {}) },
      stats: { ...defaults.stats, ...((d.stats as object) || {}) },
      hist: (d.hist as Record<string, number>) || {},
    } as typeof defaults;
    replaceAnchorState(merged);
    skipLeaveGuard(5000);
    await flushAnchorState();
    location.reload();
    return true;
  } catch {
    toast("That file isn't a valid backup.");
    return false;
  }
}