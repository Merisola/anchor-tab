let ctxA: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctxA) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) ctxA = new AC();
    }
    if (ctxA?.state === "suspended") void ctxA.resume();
  } catch {
    /* ignore */
  }
  return ctxA;
}

export function beep(sound: boolean): void {
  if (!sound) return;
  try {
    const a = audio();
    if (!a) return;
    [659, 784, 988].forEach((f, i) => {
      const o = a.createOscillator();
      const g = a.createGain();
      o.frequency.value = f;
      o.type = "sine";
      o.connect(g);
      g.connect(a.destination);
      const t = a.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.start(t);
      o.stop(t + 0.55);
    });
  } catch {
    /* ignore */
  }
}

export function notify(title: string, body: string, loud: boolean, sound: boolean): void {
  if (!loud) beep(sound);
  try {
    if (typeof chrome !== "undefined" && chrome.notifications && chrome.runtime?.id) {
      chrome.notifications.create("anchor-" + Date.now(), {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title,
        message: body,
        requireInteraction: !!loud,
        priority: 2,
      });
      return;
    }
  } catch {
    /* ignore */
  }
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      const n = new Notification(title, {
        body,
        tag: "anchor",
        requireInteraction: !!loud,
      } as NotificationOptions);
      n.onclick = () => {
        window.focus();
        n.close();
      };
    }
  } catch {
    /* ignore */
  }
}

export function alarmBurst(sound: boolean, burstNumber: number): void {
  try {
    if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 300]);
  } catch {
    /* ignore */
  }
  if (!sound) return;
  const a = audio();
  if (!a) return;
  const vol = Math.min(0.7, 0.28 + burstNumber * 0.08);
  [0, 0.28, 0.56, 0.84].forEach((o, i) => {
    const x = a.createOscillator();
    const g = a.createGain();
    const t = a.currentTime + o;
    x.type = "square";
    x.frequency.value = i % 2 ? 1175 : 880;
    x.connect(g);
    g.connect(a.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    x.start(t);
    x.stop(t + 0.26);
  });
}

export function primeAudio(): void {
  audio();
}

export function stopVibration(): void {
  try {
    if (navigator.vibrate) navigator.vibrate(0);
  } catch {
    /* ignore */
  }
}