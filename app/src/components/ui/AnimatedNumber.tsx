import { useEffect, useRef, useState } from "react";

export function AnimatedNumber({ value, motion }: { value: number; motion: boolean }) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (!motion || from === value) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 500);
      setDisplay(Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, motion]);

  return <>{display}</>;
}