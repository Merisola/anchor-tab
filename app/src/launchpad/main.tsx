import { createRoot } from "react-dom/client";
import "../styles/tailwind.css";
import "../styles/newtab.css";
import "../styles/launchpad.css";
import { ToastHost } from "../components/ui/ToastHost";
import { initAnchorState } from "../state/anchorStore";
import { initBackground } from "../state/backgroundStore";
import { initFields } from "../state/fieldsStore";
import { LaunchpadPage } from "./LaunchpadPage";

async function boot(): Promise<void> {
  await Promise.all([initAnchorState(), initFields(), initBackground()]);

  const holder = document.getElementById("root");
  if (!holder) throw new Error("Missing #root");
  createRoot(holder).render(
    <>
      <LaunchpadPage />
      <ToastHost />
    </>,
  );
}

void boot();