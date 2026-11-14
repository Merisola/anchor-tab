import { useEffect, useRef, useState } from "react";
import { setToastListener } from "../../lib/toast";

export function ToastHost() {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setToastListener((m) => {
      setMessage(m);
      setVisible(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setVisible(false), 2600);
    });
    return () => setToastListener(null);
  }, []);

  return (
    <div id="toast" className={"toast" + (visible ? " show" : "")} role="status" aria-live="polite">
      {message}
    </div>
  );
}