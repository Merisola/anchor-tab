import type { ReactNode } from "react";

type SettingsSectionProps = {
  id: string;
  eyebrow: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/**
 * A collapsible Settings card. Every section starts closed on each visit; the
 * contents stay mounted so typed text and local UI state survive a collapse.
 */
export function SettingsSection({
  id,
  eyebrow,
  title,
  open,
  onToggle,
  children,
}: SettingsSectionProps) {
  const titleId = `${id}-title`;
  const bodyId = `${id}-body`;

  return (
    <section
      className={"panel settings-card settings-section" + (open ? " open" : "")}
      id={id}
    >
      <div className="settings-section-head">
        <span className="eyebrow">{eyebrow}</span>
        <h2 id={titleId}>{title}</h2>
        <span className="settings-section-caret" aria-hidden="true" />
        <button
          type="button"
          className="settings-section-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          aria-labelledby={titleId}
          onClick={onToggle}
        />
      </div>
      <div className="settings-section-body" id={bodyId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
