import { createRoot } from "react-dom/client";
import "../styles/tailwind.css";
import "../styles/newtab.css";
import { initAnchorState } from "../state/anchorStore";
import { initBackground } from "../state/backgroundStore";
import { initDriveWithState } from "../state/driveBoot";
import { initFields } from "../state/fieldsStore";
import { FocusProvider } from "../state/focus";
import { NewTab } from "./NewTab";
import { UiProvider } from "./ui";

async function boot(): Promise<void> {
  await Promise.all([initAnchorState(), initFields(), initBackground()]);

  const holder = document.getElementById("root");
  if (!holder) throw new Error("Missing #root");
  createRoot(holder).render(
    <UiProvider>
      <FocusProvider>
        <NewTab />
      </FocusProvider>
    </UiProvider>,
  );

  await initDriveWithState();
}

void boot();