import { useRef, useState, type DragEvent, type ClipboardEvent } from "react";
import { copyImageToClipboard, shrinkImage } from "../lib/image";
import { normUrl, safeUrl } from "../lib/helpers";
import { toast } from "../lib/toast";
import type { FieldItem } from "../lib/types";
import { optsOf } from "./types";

interface Props {
  item: FieldItem;
  onChange: (value: unknown) => void;
  onZoom: (src: string) => void;
}

export function FieldControl({ item, onChange, onZoom }: Props) {
  const c = item.cfg || {};
  const value = item.value;
  const num = (v: unknown): number | undefined => {
    const n = Number(v);
    return v !== "" && v != null && Number.isFinite(n) ? n : undefined;
  };

  if (item.type === "text") {
    return (
      <input
        type="text"
        value={String(value || "")}
        placeholder={String(c.placeholder || "")}
        maxLength={num(c.max)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (item.type === "textarea" || (item.type === "question" && c.style !== "short")) {
    return (
      <textarea
        value={String(value || "")}
        rows={item.type === "question" ? 4 : num(c.rows) || 4}
        placeholder={item.type === "question" ? "Your answer…" : String(c.placeholder || "")}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (item.type === "question") {
    return (
      <input
        type="text"
        value={String(value || "")}
        placeholder="Your answer…"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (item.type === "select") {
    return (
      <select value={String(value || "")} onChange={(e) => onChange(e.target.value)}>
        <option value="">{String(c.placeholder || "Choose…")}</option>
        {optsOf(c).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  if (item.type === "multi") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    const options = optsOf(c);
    if (!options.length) return <p className="help">No options yet. Edit this field to add some.</p>;
    return (
      <div className="opts">
        {options.map((o) => (
          <label key={o}>
            <input
              type="checkbox"
              checked={selected.includes(o)}
              onChange={() => {
                const next = new Set(selected);
                if (next.has(o)) next.delete(o);
                else next.add(o);
                onChange(options.filter((x) => next.has(x)));
              }}
            />
            {o}
          </label>
        ))}
      </div>
    );
  }

  if (item.type === "checkbox") {
    return (
      <div className="row">
        <label>
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          {String(c.label || "Done")}
        </label>
      </div>
    );
  }

  if (item.type === "url") {
    const url = normUrl(String(value || ""));
    return (
      <div className="row">
        <input
          type="url"
          value={String(value || "")}
          placeholder={String(c.placeholder || "https://…")}
          onChange={(e) => onChange(e.target.value)}
        />
        {url === "#" ? (
          <button className="btn quiet off" type="button" disabled>
            Open
          </button>
        ) : (
          <a className="btn quiet" href={url} target="_blank" rel="noopener noreferrer">
            Open
          </a>
        )}
      </div>
    );
  }

  if (item.type === "number") {
    return (
      <div className="row">
        <input
          type="number"
          value={value === "" || value == null ? "" : Number(value)}
          step={num(c.step) || 1}
          min={num(c.min)}
          max={num(c.max)}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        />
        {c.unit ? <span className="unit">{String(c.unit)}</span> : null}
      </div>
    );
  }

  if (item.type === "date") {
    return <input type="date" value={String(value || "")} onChange={(e) => onChange(e.target.value)} />;
  }

  if (item.type === "rating") {
    const max = Math.min(10, Math.max(3, num(c.max) || 5));
    const score = Number(value) || 0;
    return (
      <div className="stars">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className={"star" + (n <= score ? " on" : "")}
            title={n + " of " + max}
            onClick={() => onChange(score === n ? 0 : n)}
          >
            ★
          </button>
        ))}
      </div>
    );
  }

  if (item.type === "clip") {
    return <ClipControl item={item} onChange={onChange} />;
  }

  if (item.type === "image") {
    return <ImageControl item={item} onChange={onChange} onZoom={onZoom} />;
  }

  return <span />;
}

function ClipControl({ item, onChange }: { item: FieldItem; onChange: (value: unknown) => void }) {
  const c = item.cfg || {};
  const ref = useRef<HTMLTextAreaElement>(null);
  const value = String(item.value || "");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast("Copied.");
    } catch {
      ref.current?.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        /* ignore */
      }
      toast(ok ? "Copied." : "Press Ctrl+C to copy.");
    }
  };
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text);
      toast("Pasted.");
    } catch {
      ref.current?.focus();
      toast("Press Ctrl+V to paste.");
    }
  };
  return (
    <div className="imgwrap">
      <textarea
        ref={ref}
        value={value}
        rows={Number(c.rows) || 3}
        placeholder="Paste or type something you reuse…"
        className={c.style === "mono" ? "mono" : ""}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="irow2">
        <button type="button" className="btn quiet sm" onClick={copy}>
          Copy
        </button>
        <button type="button" className="btn quiet sm" onClick={paste}>
          Paste
        </button>
      </div>
    </div>
  );
}

function ImageControl({
  item,
  onChange,
  onZoom,
}: {
  item: FieldItem;
  onChange: (value: unknown) => void;
  onZoom: (src: string) => void;
}) {
  const c = item.cfg || {};
  const maxW = Math.min(2400, Math.max(200, Number(c.max) || 1000));
  const value = String(item.value || "");
  const [over, setOver] = useState(false);
  const [armed, setArmed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const take = async (file: File | null | undefined) => {
    if (!file || !file.type.startsWith("image/")) return toast("That isn't an image.");
    if (file.size > 15e6) return toast("That image is too large (15 MB max).");
    try {
      onChange(await shrinkImage(file, maxW));
    } catch {
      toast("Couldn't read that image.");
    }
  };

  const copy = async () => {
    try {
      await copyImageToClipboard(value);
      toast("Image copied.");
    } catch {
      toast("Copy isn't supported here. Right-click the image to copy it.");
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const it = [...(e.clipboardData?.items || [])].find((i) => i.type && i.type.startsWith("image/"));
    if (it) {
      e.preventDefault();
      void take(it.getAsFile());
    } else toast("No image found in your clipboard.");
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    void take(e.dataTransfer?.files?.[0]);
  };

  return (
    <div className="imgwrap">
      {value ? (
        <img src={value} alt={item.title || "Saved image"} title="Click to enlarge" onClick={() => onZoom(value)} />
      ) : null}
      <div
        className={"drop" + (over ? " over" : "")}
        tabIndex={0}
        onClick={(e) => e.currentTarget.focus()}
        onPaste={onPaste}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        {value
          ? "Click here, then press Ctrl+V to replace, or drop a new image"
          : "Click here, then press Ctrl+V to paste an image, or drop one here"}
      </div>
      <div className="irow2">
        <button type="button" className="btn quiet sm" onClick={() => fileRef.current?.click()}>
          Upload
        </button>
        {value ? (
          <>
            <button type="button" className="btn quiet sm" onClick={copy}>
              Copy image
            </button>
            <button
              type="button"
              className="btn quiet sm"
              onClick={() => {
                if (!armed) {
                  setArmed(true);
                  window.setTimeout(() => setArmed(false), 3000);
                } else {
                  setArmed(false);
                  onChange("");
                }
              }}
            >
              {armed ? "Confirm?" : "Remove"}
            </button>
          </>
        ) : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void take(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}