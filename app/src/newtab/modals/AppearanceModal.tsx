import { useRef } from "react";
import { Modal } from "../../components/ui/Modal";
import { ACCENTS, DEFAULT_LOOK, THEMES } from "../../lib/defaults";
import { shrinkImage } from "../../lib/image";
import { useLookReport } from "../../lib/look";
import { toast } from "../../lib/toast";
import type { DateMode } from "../../lib/types";
import { setLook } from "../../state/actions";
import { useAnchorState } from "../../state/anchorStore";
import { setBackground, useBackground } from "../../state/backgroundStore";
import { useUi } from "../ui";

export function AppearanceModal() {
  const ui = useUi();
  const state = useAnchorState();
  const bg = useBackground();
  const report = useLookReport();
  const open = ui.modal === "look";
  const look = state.look;
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("That isn’t an image.");
      return;
    }
    try {
      const data = await shrinkImage(file, 1600);
      const ok = await setBackground(data);
      if (!ok) toast("The photo works now but couldn’t be saved: storage is full.");
      setLook({ bgStyle: "photo" });
    } catch {
      toast("Couldn’t read that image.");
    }
  };

  const removePhoto = async () => {
    await setBackground("");
    if (look.bgStyle === "photo") setLook({ bgStyle: "plain" });
  };

  return (
    <Modal open={open} onClose={ui.close} wide>
      <div className="eyebrow">Appearance</div>
      <h2>Make it yours</h2>
      <div className="rcheck" id="rCheck">
        ✓ Readability check: {report.checks} text and background pairs pass.
        {report.fixes.length ? ` Auto-adjusted: ${[...new Set(report.fixes)].join(", ")}.` : ""}
        {report.autoDim ? ` Photo cover raised to ${report.autoDim}% so text stays readable.` : ""}
      </div>
      <div className="lprev">
        <div className="pv s">
          <b>Body text sample</b>
          <small>Muted helper text</small>
          <button className="btn primary" type="button" tabIndex={-1}>
            Primary
          </button>{" "}
          <button className="btn secondary" type="button" tabIndex={-1}>
            Secondary
          </button>
        </div>
        <div className="pv d">
          <b>Timer card</b>
          <small>Muted on dark</small>
          <button className="btn brass" type="button" tabIndex={-1}>
            Start
          </button>
        </div>
      </div>
      <span className="lbl">Theme</span>
      <div className="themes" id="themeGrid">
        {THEMES.map((T) => (
          <button
            key={T.id}
            type="button"
            className={"theme" + (look.theme === T.id ? " on" : "")}
            onClick={() => setLook({ theme: T.id })}
          >
            <div className="dots">
              {[T.paper, T.surface, T.accent, T.brass, T.deep].map((c, i) => (
                <i key={i} style={{ background: c }} />
              ))}
            </div>
            <b>{T.name}</b>
          </button>
        ))}
      </div>
      <span className="lbl">Accent color</span>
      <div className="swatches" id="accentRow">
        <button
          type="button"
          className={"sw1" + (!look.accent ? " on" : "")}
          title="Use the theme’s own accent"
          style={{
            background: (THEMES.find((t) => t.id === look.theme) || THEMES[0]).accent,
            color: "#fff",
            fontSize: 13,
          }}
          onClick={() => setLook({ accent: "" })}
        >
          ↺
        </button>
        {ACCENTS.map((c) => (
          <button
            key={c}
            type="button"
            className={"sw1" + (look.accent === c ? " on" : "")}
            title={c}
            style={{ background: c }}
            onClick={() => setLook({ accent: c })}
          />
        ))}
        <input
          type="color"
          title="Pick any color (it is adjusted to stay readable)"
          value={look.accent || "#3f6b57"}
          onChange={(e) => setLook({ accent: e.target.value })}
        />
      </div>
      <span className="lbl">Background</span>
      <div className="bgs" id="bgStyles">
        {([
          ["plain", "Plain"],
          ["glow", "Soft glow"],
          ["aurora", "Aurora"],
          ["dots", "Dots"],
          ["photo", "My photo"],
        ] as const).map(([k, t]) => (
          <button
            key={k}
            type="button"
            className={look.bgStyle === k ? "on" : ""}
            onClick={() => {
              if (k === "photo" && !bg.image) {
                fileRef.current?.click();
                return;
              }
              setLook({ bgStyle: k });
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="photo-box" hidden={look.bgStyle !== "photo"}>
        <div className="irow2">
          <button className="btn secondary" type="button" onClick={() => fileRef.current?.click()}>
            Upload photo
          </button>
          <button className="btn quiet" type="button" onClick={() => void removePhoto()}>
            Remove photo
          </button>
        </div>
        <label>
          Cover strength (higher keeps text easier to read)
          <input
            type="range"
            min={0}
            max={90}
            value={look.dim ?? 45}
            onChange={(e) => setLook({ dim: +e.target.value })}
          />
        </label>
        <label>
          Blur
          <input
            type="range"
            min={0}
            max={14}
            value={look.blur || 0}
            onChange={(e) => setLook({ blur: +e.target.value })}
          />
        </label>
      </div>
      <span className="lbl">Corner roundness</span>
      <input
        type="range"
        min={4}
        max={32}
        value={look.radius || 20}
        onChange={(e) => setLook({ radius: +e.target.value })}
      />
      <span className="lbl">Heading style</span>
      <div className="seg" id="fontRow">
        {([
          ["serif", "Elegant serif"],
          ["sans", "Clean sans"],
        ] as const).map(([k, t]) => (
          <button
            key={k}
            type="button"
            className={(look.font || "serif") === k ? "on" : ""}
            onClick={() => setLook({ font: k })}
          >
            {t}
          </button>
        ))}
      </div>
      <span className="lbl">Date display</span>
      <div className="seg" id="dateRow">
        {([
          ["both", "Ethiopian + Gregorian"],
          ["eth", "Ethiopian first"],
          ["greg", "Gregorian first"],
        ] as const).map(([k, t]) => (
          <button
            key={k}
            type="button"
            className={(look.dateMode || "both") === k ? "on" : ""}
            onClick={() => setLook({ dateMode: k as DateMode })}
          >
            {t}
          </button>
        ))}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="modal-actions">
        <button
          className="btn quiet"
          type="button"
          onClick={async () => {
            await setBackground("");
            setLook({ ...DEFAULT_LOOK });
            toast("Appearance reset.");
          }}
        >
          Reset appearance
        </button>
        <button className="btn primary" type="button" onClick={ui.close}>
          Done
        </button>
      </div>
    </Modal>
  );
}