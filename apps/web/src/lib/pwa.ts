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

const nav = () => (typeof navigator === "undefined" ? { userAgent: "", maxTouchPoints: 0 } : navigator);

/** iPhone or iPad, any browser (iPadOS reports itself as a Mac with touch). */
export function isIos(ua = nav().userAgent, touch = nav().maxTouchPoints): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1);
}

/** iPhone/iPad Safari. */
export function isIosSafari(ua = nav().userAgent, touch = nav().maxTouchPoints): boolean {
  return isIos(ua, touch) && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
}

/**
 * Which "Add to Home Screen" instructions fit this iOS browser. Safari has it in the Share
 * sheet; since iOS 16.4 Chrome, Edge and Firefox offer it in their own Share menu too.
 * The website can't install itself on iOS, so we only ever show instructions.
 */
export type IosBrowser = "safari" | "chrome" | "edge" | "firefox" | "other";
export function iosBrowser(ua = nav().userAgent): IosBrowser {
  if (/CriOS/.test(ua)) return "chrome";
  if (/EdgiOS/.test(ua)) return "edge";
  if (/FxiOS/.test(ua)) return "firefox";
  return isIosSafari(ua, 5) ? "safari" : "other";
}

export function installMode(): InstallMode {
  if (isStandalone() || readFlag("ytx-installed")) return "installed";
  if (deferred) return "prompt"; // Chromium: Android Chrome/Edge/Samsung Internet, desktop Chrome/Edge
  if (isIos()) return "ios";
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
  else rememberDismissal(); // declined in the browser's own dialog: don't ask again for 30 days
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
  // Opened as the installed app (or switched into it): stop offering installation.
  window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", (m) => m.matches && (writeFlag("ytx-installed"), emit()));
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    const register = () => navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(version)}`, { scope: "/" }).catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }
}
