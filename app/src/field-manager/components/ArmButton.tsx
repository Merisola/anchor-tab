import { useEffect, useRef, useState } from "react";

export function ArmButton({
  label,
  confirmLabel = "Confirm?",
  title,
  className = "mini danger",
  onConfirm,
}: {
  label: string;
  confirmLabel?: string;
  title?: string;
  className?: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      className={className}
      title={title}
      onClick={() => {
        if (armed) {
          setArmed(false);
          window.clearTimeout(timer.current);
          onConfirm();
        } else {
          setArmed(true);
          timer.current = window.setTimeout(() => setArmed(false), 3000);
        }
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}