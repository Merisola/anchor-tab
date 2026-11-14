import { AiModal } from "../newtab/modals/AiModal";
import { AppearanceModal } from "../newtab/modals/AppearanceModal";
import { DriveModal } from "../newtab/modals/DriveModal";
import { WidgetModal } from "../newtab/modals/WidgetModal";

export function SettingsModals() {
  return (
    <>
      <WidgetModal />
      <AppearanceModal />
      <AiModal />
      <DriveModal />
    </>
  );
}