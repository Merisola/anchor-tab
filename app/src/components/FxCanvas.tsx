import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  c: string;
  r: number;
  vr: number;
  l: number;
}

let burstHandler: ((el: Element | null, count: number) => void) | null = null;

export function burst(el?: Element | null, count = 36): void {
  burstHandler?.(el || null, count);
}

export function FxCanvas({ enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const fx = ref.current;
    if (!fx) return;
    const ctx = fx.getContext("2d");
    if (!ctx) return;
    let parts: Particle[] = [];
    let running = false;
    const fit = () => {
      fx.width = window.innerWidth;
      fx.height = window.innerHeight;
    };
    fit();
    window.addEventListener("resize", fit);

    const cssv = (name: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";

    const loop = () => {
      ctx.clearRect(0, 0, fx.width, fx.height);
      parts = parts.filter((p) => p.l-- > 0);
      parts.forEach((p) => {
        p.vy += 0.18;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.l / 30);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (parts.length) requestAnimationFrame(loop);
      else {
        running = false;
        ctx.clearRect(0, 0, fx.width, fx.height);
      }
    };

    burstHandler = (el, count) => {
      if (!enabledRef.current) return;
      let x = window.innerWidth / 2;
      let y = window.innerHeight / 3;
      if (el) {
        const r = el.getBoundingClientRect();
        x = r.left + r.width / 2;
        y = r.top + r.height / 2;
      }
      const colors = [cssv("--accent"), cssv("--brass"), cssv("--accent-d"), cssv("--brass-ink")];
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 3 + Math.random() * (el ? 5 : 8);
        parts.push({
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - (el ? 3 : 5),
          w: 5 + Math.random() * 5,
          h: 3 + Math.random() * 4,
          c: colors[i % colors.length],
          r: Math.random() * 6,
          vr: (Math.random() - 0.5) * 0.4,
          l: 70 + Math.random() * 40,
        });
      }
      if (!running) {
        running = true;
        requestAnimationFrame(loop);
      }
    };

    return () => {
      window.removeEventListener("resize", fit);
      burstHandler = null;
      parts = [];
    };
  }, []);

  return <canvas id="fx" ref={ref} aria-hidden="true" />;
}