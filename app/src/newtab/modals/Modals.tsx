import { AiModal } from "./AiModal";
import { AppearanceModal } from "./AppearanceModal";
import { BlockModal } from "./BlockModal";
import { CalendarModal } from "./CalendarModal";
import { DriveModal } from "./DriveModal";
import { GateModal } from "./GateModal";
import { QuickTaskModal } from "./QuickTaskModal";
import { TaskModal } from "./TaskModal";
import { WidgetModal } from "./WidgetModal";

export function Modals() {
  return (
    <>
      <QuickTaskModal />
      <CalendarModal />
      <WidgetModal />
      <AppearanceModal />
      <BlockModal />
      <AiModal />
      <TaskModal />
      <GateModal />
      <DriveModal />
    </>
  );
}