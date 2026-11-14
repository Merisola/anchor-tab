import type { MouseEvent, ReactNode } from "react";

export function Modal({
  open,
  onClose,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  const backdrop = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };
  return (
    <div className={"overlay" + (open ? " show" : "")} onMouseDown={backdrop}>
      <div className={"modal" + (wide ? " wide" : "")}>{children}</div>
    </div>
  );
}