import { useUi } from "./ui";

export function Lightbox() {
  const ui = useUi();
  return (
    <div
      className={"lightbox" + (ui.lightbox ? " show" : "")}
      id="lightbox"
      onClick={ui.closeLightbox}
    >
      {ui.lightbox ? <img src={ui.lightbox} alt="Full size image" /> : null}
    </div>
  );
}