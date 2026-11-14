import { clone } from "../lib/helpers";
import { skipLeaveGuard } from "../lib/leaveGuard";
import { toast } from "../lib/toast";
import type { AnchorState, BackupPayload } from "../lib/types";
import {
  flushAnchorState,
  getAnchorState,
  replaceAnchorState,
} from "./anchorStore";
import { initDrive } from "./driveStore";
import { getFields, replaceFieldsNow } from "./fieldsStore";

export async function initDriveWithState(): Promise<void> {
  await initDrive({
    collect: async (): Promise<BackupPayload> => {
      const { timer, ai, alarm, ...rest } = getAnchorState();
      void timer;
      void ai;
      void alarm;
      return { state: rest, fields: getFields() };
    },
    apply: async (payload: BackupPayload): Promise<void> => {
      const current = getAnchorState();
      const next = {
        ...clone(payload.state),
        timer: current.timer,
        ai: current.ai,
        alarm: current.alarm,
      } as AnchorState;
      replaceAnchorState(next, false);
      if (payload.fields) await replaceFieldsNow(payload.fields);
      await flushAnchorState();
      skipLeaveGuard(5000);
      location.reload();
    },
    toast,
  });
}