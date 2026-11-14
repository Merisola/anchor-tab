import { safeUrl } from "../../lib/helpers";
import { skipLeaveGuard } from "../../lib/leaveGuard";
import { useAnchorState } from "../../state/anchorStore";

export function VaultBlock() {
  const state = useAnchorState();
  const url = safeUrl((state.resumeUrl || "").trim());
  return (
    <div className="panel">
      <div className="eyebrow">Vault</div>
      <div className="vlabel">Resume / portfolio</div>
      <div className={"vprev" + (url === "#" ? " none" : "")} id="vResume">
        {url === "#" ? (
          "No link saved yet."
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer">
            {url}
          </a>
        )}
      </div>
      <div className="vlabel">Career direction</div>
      <div className={"vprev" + (!state.careerNotes.trim() ? " none" : "")} id="vCareer">
        {state.careerNotes.trim() || "Nothing saved yet."}
      </div>
      <div className="vlabel">Archive / daily dump</div>
      <div className={"vprev" + (!state.archiveNotes.trim() ? " none" : "")} id="vArchive">
        {state.archiveNotes.trim() || "Nothing saved yet."}
      </div>
      <a
        className="btn secondary"
        id="openVault"
        style={{ marginTop: 14, display: "inline-block", textDecoration: "none" }}
        href="settings.html#vault"
        onClick={() => skipLeaveGuard()}
      >
        Open full vault
      </a>
    </div>
  );
}