import { createRoot } from "react-dom/client";
import "../styles/tailwind.css";
import "../styles/newtab.css";
import "../styles/settings.css";
import { ToastHost } from "../components/ui/ToastHost";
import { initAnchorState } from "../state/anchorStore";
import { initBackground } from "../state/backgroundStore";
import { initDriveWithState } from "../state/driveBoot";
import { initFields } from "../state/fieldsStore";
import { UiProvider } from "../newtab/ui";
import { SettingsModals } from "./SettingsModals";
import { SettingsPage } from "./SettingsPage";

async function boot(): Promise<void> {
  await Promise.all([initAnchorState(), initFields(), initBackground()]);

  const holder = document.getElementById("root");
  if (!holder) throw new Error("Missing #root");
  createRoot(holder).render(
    <UiProvider>
      <SettingsPage />
      <SettingsModals />
      <ToastHost />
    </UiProvider>,
  );

  await initDriveWithState();
}

void boot();