import { useEffect, useRef, useState } from "react";
import { exportBackup, importBackup } from "../lib/backup";
import { safeUrl } from "../lib/helpers";
import { toast } from "../lib/toast";
import { setVault } from "../state/actions";
import { useAnchorState } from "../state/anchorStore";

export function CareerVaultSection() {
  const state = useAnchorState();
  const [resumeUrl, setResumeUrl] = useState(state.resumeUrl || "");
  const [careerNotes, setCareerNotes] = useState(state.careerNotes || "");
  const [archiveNotes, setArchiveNotes] = useState(state.archiveNotes || "");
  const timer = useRef<number | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const latest = useRef({ resumeUrl, careerNotes, archiveNotes });
  latest.current = { resumeUrl, careerNotes, archiveNotes };

  useEffect(() => {
    return () => window.clearTimeout(timer.current);
  }, []);

  const save = (announce = false) => {
    setVault(latest.current);
    if (announce) toast("Vault saved on this device.");
  };

  const schedule = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save(), 600);
  };

  const openResume = () => {
    const url = safeUrl((resumeUrl || "").trim());
    if (url === "#") {
      toast("Add a valid https:// link first.");
      return;
    }
    window.open(url, "_blank", "noopener");
  };

  return (
    <>
      <p>Saved automatically in this browser. Keep passwords out.</p>

      <div className="settings-form">
        <label htmlFor="resumeUrl">Resume / portfolio link</label>
        <div className="add-row">
          <input
            id="resumeUrl"
            type="url"
            placeholder="https://…"
            value={resumeUrl}
            onChange={(e) => {
              setResumeUrl(e.target.value);
              schedule();
            }}
          />
          <button className="btn quiet" id="openResume" type="button" onClick={openResume}>
            Open
          </button>
        </div>

        <label htmlFor="careerNotes">Career direction</label>
        <textarea
          id="careerNotes"
          placeholder="What are you building toward? What matters next?"
          value={careerNotes}
          onChange={(e) => {
            setCareerNotes(e.target.value);
            schedule();
          }}
        />

        <label htmlFor="archiveNotes">Archive / daily dump</label>
        <textarea
          id="archiveNotes"
          placeholder="Loose thoughts, ideas, things to revisit…"
          value={archiveNotes}
          onChange={(e) => {
            setArchiveNotes(e.target.value);
            schedule();
          }}
        />
      </div>

      <div className="settings-actions">
        <button className="btn primary" id="saveVault" type="button" onClick={() => save(true)}>
          Save vault
        </button>
      </div>

      <div className="settings-divider">
        <b>Backup</b>
        <small>Export a copy of everything, or restore a previous backup file.</small>
      </div>
      <div className="settings-actions">
        <button className="btn secondary" id="exportBtn" type="button" onClick={() => exportBackup(state)}>
          Export backup
        </button>
        <button className="btn quiet" id="importBtn" type="button" onClick={() => fileRef.current?.click()}>
          Import backup
        </button>
        <input
          ref={fileRef}
          type="file"
          id="importFile"
          accept="application/json"
          hidden
          onChange={(e) => {
            void importBackup(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </>
  );
}