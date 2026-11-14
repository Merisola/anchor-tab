import { useSyncExternalStore } from "react";
import { THEMES } from "./defaults";
import type { Look } from "./types";

const hx = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const th = (a: number[]): string =>
  "#" + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

export const mix = (a: string, b: string, t: number): string => {
  const x = hx(a);
  const y = hx(b);
  return th(x.map((v, i) => v * (1 - t) + y[i] * t));
};

export const lum = (h: string): number => {
  const c = hx(h).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

export const onColor = (h: string): string => {
  const L = lum(h);
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.0575 ? "#ffffff" : "#0d1511";
};

export function tuneAccent(c: string, dark: boolean): string {
  let a = c;
  let n = 0;
  if (dark) while (lum(a) < 0.2 && n++ < 14) a = mix(a, "#ffffff", 0.1);
  else while (lum(a) > 0.18 && n++ < 14) a = mix(a, "#000000", 0.08);
  return a;
}

const contrast = (a: string, b: string): number => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

function ensureC(fg: string, bgs: string[], min: number): string {
  let c = fg;
  let n = 0;
  const mean = bgs.reduce((t, b) => t + lum(b), 0) / bgs.length;
  const target = mean > 0.35 ? "#000000" : "#ffffff";
  while (bgs.some((b) => contrast(c, b) < min) && n++ < 40) c = mix(c, target, 0.07);
  return c;
}

export const sampleOf = (src: string): Promise<string[]> =>
  new Promise((resolve) => {
    if (!src) return resolve([]);
    const i = new Image();
    i.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 6;
        const x = c.getContext("2d");
        if (!x) return resolve([]);
        x.drawImage(i, 0, 0, 6, 6);
        const d = x.getImageData(0, 0, 6, 6).data;
        const o: string[] = [];
        for (let k = 0; k < d.length; k += 4) o.push(th([d[k], d[k + 1], d[k + 2]]));
        resolve(o);
      } catch {
        resolve([]);
      }
    };
    i.onerror = () => resolve([]);
    i.src = src;
  });

export interface LookReport {
  fixes: string[];
  checks: number;
  autoDim: number;
}

let report: LookReport = { fixes: [], checks: 0, autoDim: 0 };
const reportListeners = new Set<() => void>();

export function setLookReport(next: LookReport): void {
  report = next;
  reportListeners.forEach((l) => l());
}

export function useLookReport(): LookReport {
  return useSyncExternalStore(
    (l) => {
      reportListeners.add(l);
      return () => reportListeners.delete(l);
    },
    () => report,
    () => report,
  );
}

function guard(v: Record<string, string>, T: (typeof THEMES)[number], dark: boolean, S: string): LookReport {
  const fixes: string[] = [];
  let checks = 0;
  const fx = (k: string, bgs: string[], min: number, label: string) => {
    const o = v[k];
    v[k] = ensureC(o, bgs, min);
    checks += bgs.length;
    if (v[k] !== o) fixes.push(label);
  };
  const B = () => [v.paper, v.surface, v.tint, v.soft, v.warm, v.cool, v.quiet, v.field, v.hover];
  fx("ink", B(), 7, "main text");
  fx("ink2", B(), 4.5, "body text");
  fx("muted", B(), 4.5, "muted text");
  fx("quiet-ink", [v.quiet, v.surface, v.paper], 4.5, "quiet buttons");
  fx("accent-d", B(), 4.5, "accent text");
  v["brass-ink"] = T.brass;
  fx("brass-ink", [v.warm, v.surface, v.tint], 4.5, "gold text");
  v["danger-ink"] = dark ? "#e8887a" : "#a85b50";
  fx("danger-ink", [v.surface, v.tint, mix(v["danger-ink"], S, 0.16)], 4.5, "alert text");
  const a0 = v.accent;
  v.accent = ensureC(a0, [S, v.paper], 3);
  checks += 2;
  if (v.accent !== a0) fixes.push("accent color");
  v["on-accent"] = onColor(v.accent);
  v["on-brass"] = onColor(T.brass);
  const di = lum(T.deep) < 0.4 ? "#f1efe6" : "#17201b";
  v["deep-ink"] = di;
  v["deep-muted"] = ensureC(mix(di, T.deep, 0.3), [T.deep, mix(T.deep, "#000000", 0.2)], 4.5);
  checks += 2;
  return { fixes, checks, autoDim: 0 };
}

const BG_STYLES: Record<string, string> = {
  plain: "none",
  glow:
    "radial-gradient(900px 520px at 8% -8%,color-mix(in srgb,var(--accent) 24%,transparent),transparent 62%),radial-gradient(800px 520px at 100% 0%,color-mix(in srgb,var(--brass) 22%,transparent),transparent 58%)",
  aurora:
    "radial-gradient(700px 500px at 15% 10%,color-mix(in srgb,var(--accent) 34%,transparent),transparent 60%),radial-gradient(700px 520px at 90% 20%,color-mix(in srgb,var(--brass) 30%,transparent),transparent 60%),radial-gradient(900px 600px at 50% 110%,color-mix(in srgb,var(--accent) 22%,transparent),transparent 65%)",
  dots: "radial-gradient(color-mix(in srgb,var(--ink) 14%,transparent) 1px,transparent 1.2px)",
};

export function applyLook(look: Look, bgImg: string, bgSamples: string[], bgLayer: HTMLElement | null): LookReport {
  const T = THEMES.find((t) => t.id === look.theme) || THEMES[0];
  const dark = T.dark;
  const S = T.surface;
  const I = T.ink;
  const ac = look.accent && /^#[0-9a-f]{6}$/i.test(look.accent) ? tuneAccent(look.accent, dark) : T.accent;
  const v: Record<string, string> = {
    paper: T.paper,
    surface: S,
    ink: I,
    muted: mix(I, S, 0.42),
    line: mix(S, I, 0.12),
    line2: mix(S, I, 0.08),
    tint: mix(S, I, 0.035),
    field: dark ? mix(S, I, 0.06) : "#ffffff",
    quiet: mix(S, I, 0.08),
    "quiet-ink": mix(I, S, 0.3),
    warm: mix(S, T.brass, 0.14),
    cool: mix(S, ac, 0.1),
    hover: mix(S, ac, 0.07),
    star: mix(S, I, 0.18),
    dash: mix(S, I, 0.22),
    ink2: mix(I, S, 0.15),
    soft: mix(S, ac, dark ? 0.2 : 0.13),
    accent: ac,
    "accent-d": dark ? mix(ac, "#ffffff", 0.18) : mix(ac, "#000000", 0.2),
    "on-accent": onColor(ac),
    brass: T.brass,
    deep: T.deep,
    deepline: mix(T.deep, "#ffffff", 0.12),
  };
  const r = guard(v, T, dark, S);
  const root = document.documentElement.style;
  Object.entries(v).forEach(([k, x]) => root.setProperty("--" + k, x));
  root.setProperty("color-scheme", dark ? "dark" : "light");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", T.paper);

  const photo = look.bgStyle === "photo" && !!bgImg;
  let dim = (look.dim == null ? 45 : look.dim) / 100;
  if (photo && bgSamples.length) {
    const ok = (x: number) => bgSamples.filter((c) => contrast(v.ink, mix(c, v.paper, x)) < 4.5).length <= Math.floor(bgSamples.length * 0.1);
    while (dim < 0.92 && !ok(dim)) dim += 0.02;
  }
  r.autoDim = dim > (look.dim == null ? 45 : look.dim) / 100 + 0.005 ? Math.round(dim * 100) : 0;

  if (bgLayer) {
    bgLayer.classList.toggle("photo", photo);
    bgLayer.classList.toggle("dots", look.bgStyle === "dots");
    bgLayer.style.backgroundImage = photo ? 'url("' + bgImg + '")' : BG_STYLES[look.bgStyle] || "none";
    bgLayer.style.setProperty("--bgdim", String(dim));
    bgLayer.style.filter = photo && look.blur ? "blur(" + look.blur + "px)" : "";
  }
  document.body.classList.toggle("has-bg", photo);
  root.setProperty("--r", (look.radius || 20) + "px");
  document.body.classList.toggle("sans", look.font === "sans");
  setLookReport(r);
  return r;
}