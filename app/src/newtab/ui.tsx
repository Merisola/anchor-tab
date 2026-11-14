import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { LaunchpadApp } from "../lib/types";

export type CalendarMode = "eth" | "greg";

export type ModalName =
  | "quick"
  | "widget"
  | "look"
  | "block"
  | "ai"
  | "task"
  | "gate"
  | "drive"
  | null;

export interface TaskRef {
  list: "tasks" | "backlog";
  index: number;
}

interface UiState {
  modal: ModalName;
  widgetId: string | null;
  blockId: string | null;
  taskRef: TaskRef | null;
  gateApp: LaunchpadApp | null;
  calendar: CalendarMode | null;
  editing: boolean;
  lightbox: string | null;
}

interface UiApi extends UiState {
  open: (modal: ModalName, payload?: Partial<Pick<UiState, "widgetId" | "blockId" | "taskRef" | "gateApp">>) => void;
  close: () => void;
  openWidget: (widgetId?: string | null) => void;
  openBlock: (blockId: string) => void;
  openTask: (list: "tasks" | "backlog", index: number) => void;
  openGate: (app: LaunchpadApp) => void;
  openCalendar: (mode: CalendarMode) => void;
  closeCalendar: () => void;
  setEditing: (editing: boolean) => void;
  openLightbox: (src: string) => void;
  closeLightbox: () => void;
}

const UiContext = createContext<UiApi | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [ui, setUi] = useState<UiState>({
    modal: null,
    widgetId: null,
    blockId: null,
    taskRef: null,
    gateApp: null,
    calendar: null,
    editing: false,
    lightbox: null,
  });

  const open = useCallback<UiApi["open"]>((modal, payload) => {
    setUi((u) => ({
      ...u,
      modal,
      ...(payload?.widgetId !== undefined ? { widgetId: payload.widgetId } : {}),
      ...(payload?.blockId !== undefined ? { blockId: payload.blockId } : {}),
      ...(payload?.taskRef !== undefined ? { taskRef: payload.taskRef } : {}),
      ...(payload?.gateApp !== undefined ? { gateApp: payload.gateApp } : {}),
    }));
  }, []);

  const close = useCallback(() => setUi((u) => ({ ...u, modal: null })), []);
  const openWidget = useCallback((widgetId: string | null = null) => open("widget", { widgetId }), [open]);
  const openBlock = useCallback((blockId: string) => open("block", { blockId }), [open]);
  const openTask = useCallback(
    (list: "tasks" | "backlog", index: number) => open("task", { taskRef: { list, index } }),
    [open],
  );
  const openGate = useCallback((app: LaunchpadApp) => open("gate", { gateApp: app }), [open]);
  const openCalendar = useCallback((calendar: CalendarMode) => setUi((u) => ({ ...u, calendar })), []);
  const closeCalendar = useCallback(() => setUi((u) => ({ ...u, calendar: null })), []);
  const setEditing = useCallback((editing: boolean) => setUi((u) => ({ ...u, editing })), []);
  const openLightbox = useCallback((lightbox: string) => setUi((u) => ({ ...u, lightbox })), []);
  const closeLightbox = useCallback(() => setUi((u) => ({ ...u, lightbox: null })), []);

  const value = useMemo<UiApi>(
    () => ({
      ...ui,
      open,
      close,
      openWidget,
      openBlock,
      openTask,
      openGate,
      openCalendar,
      closeCalendar,
      setEditing,
      openLightbox,
      closeLightbox,
    }),
    [
      ui,
      open,
      close,
      openWidget,
      openBlock,
      openTask,
      openGate,
      openCalendar,
      closeCalendar,
      setEditing,
      openLightbox,
      closeLightbox,
    ],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiApi {
  const v = useContext(UiContext);
  if (!v) throw new Error("UiProvider missing");
  return v;
}