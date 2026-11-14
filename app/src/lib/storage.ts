const hasChromeStorage = (): boolean =>
  typeof chrome !== "undefined" && !!chrome.storage && !!chrome.storage.local;

export async function storageGet<T>(key: string): Promise<T | null> {
  try {
    if (hasChromeStorage()) {
      const x = await chrome.storage.local.get(key);
      return (x[key] as T) ?? null;
    }
  } catch {
    /* fall through */
  }
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function storageSet<T>(key: string, value: T): Promise<boolean> {
  try {
    if (hasChromeStorage()) {
      await chrome.storage.local.set({ [key]: value });
      return true;
    }
  } catch {
    return false;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function onStorageChanged(
  key: string,
  cb: (newValue: unknown) => void,
): () => void {
  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && changes[key]) cb(changes[key].newValue);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }
  const listener = (e: StorageEvent) => {
    if (e.key === key && e.newValue) {
      try {
        cb(JSON.parse(e.newValue));
      } catch {
        /* ignore */
      }
    }
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}