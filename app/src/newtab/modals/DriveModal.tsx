import { useEffect, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Toggle } from "../../components/ui/Toggle";
import {
  backupNow,
  connectDrive,
  copyDriveRedirect,
  driveStatusText,
  restoreFromDrive,
  saveClientId,
  setDriveAuto,
  useDrive,
} from "../../state/driveStore";
import { useUi } from "../ui";

export function DriveModal() {
  const ui = useUi();
  const snap = useDrive();
  const open = ui.modal === "drive";
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    if (open) setClientId(snap.clientId);
    // Seed only when opening; typing should not be overwritten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const connected = snap.connected && !snap.needsReconnect;

  return (
    <Modal open={open} onClose={ui.close} wide>
      <div className="eyebrow">Google Drive backup</div>
      <h2>Keep a copy in your Drive</h2>
      <p>
        Your tab is saved as one small file in a hidden app folder of your own Google Drive. The app
        can only see that file, never the rest of your Drive, and there is no server in between.
        Images you add to fields are included, so the file can grow.
      </p>
      <div className="setrow">
        <div>
          <b id="dvStat">{driveStatusText(snap)}</b>
          <small id="dvNote">{snap.note}</small>
        </div>
        <button
          className="btn secondary"
          id="dvConnect"
          type="button"
          disabled={snap.busy || !snap.hasIdentity || !snap.clientId}
          onClick={connectDrive}
        >
          {connected ? "Disconnect" : snap.connected ? "Reconnect" : "Connect"}
        </button>
      </div>
      <div className="setrow">
        <div>
          <b>Auto-backup</b>
          <small>
            Saves about a minute after you change something. Pauses if Google signs you out; it
            never overwrites a Drive copy this device hasn’t seen.
          </small>
        </div>
        <Toggle checked={!!snap.auto} disabled={!snap.connected} onChange={setDriveAuto} />
      </div>
      <div className="modal-actions">
        <button
          className="btn primary"
          id="dvBackup"
          type="button"
          disabled={snap.busy || !snap.connected}
          onClick={backupNow}
        >
          {snap.pendingOverwrite ? "Overwrite Drive copy?" : "Back up now"}
        </button>
        <button
          className="btn secondary"
          id="dvRestore"
          type="button"
          disabled={snap.busy || !snap.connected}
          onClick={restoreFromDrive}
        >
          {snap.restoreArmed ? "Replace this device's data?" : "Restore from Drive"}
        </button>
      </div>
      <details id="dvSetup" style={{ marginTop: 18 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
          One-time setup: your own Google client ID (free, about 5 minutes)
        </summary>
        <ol className="hint" style={{ paddingLeft: 18, lineHeight: 1.55 }}>
          <li>
            Open{" "}
            <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">
              Google Cloud Console
            </a>
            , create a project, then <b>APIs &amp; Services → Library</b> and enable{" "}
            <b>Google Drive API</b>.
          </li>
          <li>
            <b>OAuth consent screen</b> (or Google Auth Platform): choose <b>External</b>, fill the
            app name and your email, add yourself as a <b>test user</b>, and add the scope{" "}
            <code>…/auth/drive.appdata</code>.
          </li>
          <li>
            <b>Credentials → Create credentials → OAuth client ID</b>, type <b>Web application</b>.
            Under <b>Authorized redirect URIs</b> add exactly the address below.
          </li>
          <li>
            Paste the Client ID it gives you here, save, then press <b>Connect</b>. Google may warn
            the app is “unverified”; that is normal for your own project, choose Advanced →
            Continue.
          </li>
        </ol>
        <label className="cf">
          <span>Redirect URI (copy this into Google)</span>
          <input type="text" readOnly value={snap.redirectUri} />
        </label>
        <div className="irow2" style={{ marginTop: 8 }}>
          <button className="btn quiet sm" type="button" onClick={() => void copyDriveRedirect()}>
            Copy redirect URI
          </button>
        </div>
        <label className="cf">
          <span>Client ID</span>
          <input
            type="text"
            placeholder="1234567890-abc….apps.googleusercontent.com"
            autoComplete="off"
            spellCheck={false}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
        </label>
        <div className="irow2" style={{ marginTop: 8 }}>
          <button
            className="btn secondary sm"
            type="button"
            onClick={() => {
              saveClientId(clientId);
            }}
          >
            Save client ID
          </button>
        </div>
      </details>
      <div className="modal-actions">
        <button className="btn quiet" type="button" onClick={ui.close}>
          Done
        </button>
      </div>
    </Modal>
  );
}