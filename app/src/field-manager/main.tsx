import { createRoot } from "react-dom/client";
import "../styles/tailwind.css";
import "../styles/field-manager.css";
import { flushFields, initFields } from "../state/fieldsStore";
import { FieldManagerApp } from "./FieldManagerApp";

async function boot(): Promise<void> {
  await initFields();

  const holder = document.getElementById("root");
  if (!holder) throw new Error("Missing #root");
  createRoot(holder).render(<FieldManagerApp />);

  window.addEventListener("pagehide", () => {
    void flushFields();
  });
}

void boot();