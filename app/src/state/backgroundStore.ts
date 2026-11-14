import { useSyncExternalStore } from "react";
import { sampleOf } from "../lib/look";
import { storageGet, storageSet } from "../lib/storage";

const KEY = "anchorBg";
let bgImg = "";
let samples: string[] = [];
let snapshot = { image: "", samples: [] as string[] };
const listeners = new Set<() => void>();

function emit(): void {
  snapshot = { image: bgImg, samples };
  listeners.forEach((l) => l());
}

export async function initBackground(): Promise<void> {
  bgImg = (await storageGet<string>(KEY)) || "";
  samples = bgImg ? await sampleOf(bgImg) : [];
  emit();
}

export function getBackground(): string {
  return bgImg;
}

export function getBackgroundSamples(): string[] {
  return samples;
}

export function useBackground(): { image: string; samples: string[] } {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
    () => snapshot,
  );
}

export async function setBackground(dataUrl: string): Promise<boolean> {
  bgImg = dataUrl;
  samples = dataUrl ? await sampleOf(dataUrl) : [];
  emit();
  return storageSet(KEY, bgImg);
}