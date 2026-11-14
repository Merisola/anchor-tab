import { useSyncExternalStore } from "react";
import { normalizeFields } from "../fieldkit/types";
import { onStorageChanged, storageGet, storageSet } from "../lib/storage";
import type { Field } from "../lib/types";

const KEY = "anchorFields";

let fields: Field[] = [];
let loaded = false;
let lastWritten = "";
const listeners = new Set<() => void>();
let saveTimer: number | undefined;
let pendingPatches: Record<string, unknown> = {};
let saveQueue: Promise<boolean> = Promise.resolve(true);

function emit(): void {
  listeners.forEach((l) => l());
}

function isEditing(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export async function initFields(): Promise<void> {
  const raw = await storageGet<Field[]>(KEY);
  fields = normalizeFields(raw);
  lastWritten = JSON.stringify(fields);
  loaded = true;
  emit();
  onStorageChanged(KEY, (value) => {
    if (!loaded || isEditing()) return;
    const next = normalizeFields(value);
    const json = JSON.stringify(next);
    if (json === JSON.stringify(fields) || json === lastWritten) return;
    fields = next;
    lastWritten = json;
    emit();
  });
}

export function getFields(): Field[] {
  return fields;
}

export function subscribeFields(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFields(): Field[] {
  return useSyncExternalStore(subscribeFields, getFields, getFields);
}

function scheduleFullSave(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const snapshot = fields;
    saveQueue = saveQueue.then(async () => {
      const stored = JSON.stringify(snapshot);
      lastWritten = stored;
      return storageSet(KEY, snapshot);
    });
  }, 250);
}

export function replaceFieldsLocal(next: Field[]): void {
  fields = next;
  emit();
  scheduleFullSave();
}

export function replaceFieldsNow(next: Field[]): Promise<boolean> {
  window.clearTimeout(saveTimer);
  fields = next;
  emit();
  const snapshot = next;
  const stored = JSON.stringify(snapshot);
  lastWritten = stored;
  saveQueue = saveQueue.then(() => storageSet(KEY, snapshot));
  return saveQueue;
}

export function updateFieldItem(fieldId: string, itemId: string, updater: (value: unknown) => unknown): void {
  fields = fields.map((g) =>
    g.id !== fieldId
      ? g
      : {
          ...g,
          items: g.items.map((it) => (it.id === itemId ? { ...it, value: updater(it.value) } : it)),
        },
  );
  emit();
}

export function patchFieldValue(itemId: string, value: unknown): void {
  fields = fields.map((g) => ({
    ...g,
    items: g.items.map((it) => (it.id === itemId ? { ...it, value } : it)),
  }));
  emit();
  pendingPatches[itemId] = value;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const patches = pendingPatches;
    pendingPatches = {};
    saveQueue = saveQueue.then(async () => {
      const latest = normalizeFields(await storageGet<Field[]>(KEY));
      const base = latest.length ? latest : fields;
      const merged = base.map((g) => ({
        ...g,
        items: g.items.map((it) =>
          Object.prototype.hasOwnProperty.call(patches, it.id) ? { ...it, value: patches[it.id] } : it,
        ),
      }));
      const stored = JSON.stringify(merged);
      lastWritten = stored;
      return storageSet(KEY, merged);
    });
  }, 250);
}

export function flushFields(): Promise<boolean> {
  window.clearTimeout(saveTimer);
  const snapshot = fields;
  const stored = JSON.stringify(snapshot);
  lastWritten = stored;
  saveQueue = saveQueue.then(() => storageSet(KEY, snapshot));
  return saveQueue;
}

export function findField(ref: string): Field | undefined {
  const low = (v: string) => String(v || "").trim().toLowerCase();
  return fields.find((g) => g.id === ref || low(g.title) === low(ref));
}

export function fieldSummary(g: Field) {
  return {
    id: g.id,
    title: g.title,
    help: g.help || "",
    items: g.items.map((i) => ({ id: i.id, type: i.type, title: i.title || "", help: i.help || "" })),
  };
}

export function reloadFields(): Promise<void> {
  if (isEditing()) return Promise.resolve();
  return storageGet<Field[]>(KEY).then((raw) => {
    fields = normalizeFields(raw);
    lastWritten = JSON.stringify(fields);
    emit();
  });
}