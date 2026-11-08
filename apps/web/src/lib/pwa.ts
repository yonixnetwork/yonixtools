// Install state shared by the install card and the drawer's "Install app" item.
// Only real browser mechanisms are used: Chromium's beforeinstallprompt, and on
// iOS Safari a guide to Share → Add to Home Screen (Safari has no install prompt).

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallMode = "prompt" | "ios" | "installed" | "unsupported";

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const DISMISS_KEY = "ytx-install-dismissed";
const DISMISS_DAYS = 30;

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** iPhone/iPad Safari (iPadOS reports itself as a Mac with touch). Other iOS browsers can't add to the home screen the same way. */
export function isIosSafari(ua = typeof navigator === "undefined" ? "" : navigator.userAgent, touch = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints): boolean {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1);
  return ios && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
}

export function installMode(): InstallMode {
  if (isStandalone() || readFlag("ytx-installed")) return "installed";
  if (deferred) return "prompt";
  if (isIosSafari()) return "ios";
  return "unsupported";
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const e = deferred;
  if (!e) return "unavailable";
  deferred = null; // a prompt event can be used once
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === "accepted") writeFlag("ytx-installed");
  emit();
  return outcome;
}

export function dismissedRecently(now = Date.now()): boolean {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return t > 0 && now - t < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

export function rememberDismissal(now = Date.now()) {
  try {
    localStorage.setItem(DISMISS_KEY, String(now));
  } catch {
    /* storage unavailable */
  }
}

function readFlag(k: string) {
  try {
    return localStorage.getItem(k) === "1";
  } catch {
    return false;
  }
}
function writeFlag(k: string) {
  try {
    localStorage.setItem(k, "1");
  } catch {
    /* ignore */
  }
}

let started = false;
/** Call once on the client: captures the install event and registers the service worker. */
export function startPwa(version: string) {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // show our own unobtrusive invitation instead of the mini-infobar
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  document.documentElement.dataset.pwaReady = "1"; // install listeners attached (used by tests)
  window.addEventListener("appinstalled", () => {
    deferred = null;
    writeFlag("ytx-installed");
    emit();
  });
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    const register = () => navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(version)}`, { scope: "/" }).catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }
}
