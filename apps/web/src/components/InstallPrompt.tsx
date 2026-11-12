"use client";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { dismissedRecently, installMode, iosBrowser, promptInstall, rememberDismissal, startPwa, subscribe, type InstallMode, type IosBrowser } from "@/lib/pwa";

const SHOW_AFTER_MS = 12_000; // never on arrival: only once the visitor has been here a moment

const SHARE_WHERE: Record<IosBrowser, string> = {
  safari: "in Safari's toolbar",
  chrome: "in Chrome's address bar",
  edge: "in Edge's menu",
  firefox: "in Firefox's menu",
  other: "in your browser's menu",
};

export function useInstallMode(): InstallMode | null {
  const [mode, setMode] = useState<InstallMode | null>(null);
  useEffect(() => {
    const update = () => setMode(installMode());
    update();
    return subscribe(update);
  }, []);
  return mode;
}

/** Registers the service worker and shows the install invitation where the browser really supports installing. */
export function InstallPrompt({ version }: { version: string }) {
  const mode = useInstallMode();
  const [visible, setVisible] = useState(false);
  const [guide, setGuide] = useState(false);
  const [browser, setBrowser] = useState<IosBrowser>("safari");
  useEffect(() => setBrowser(iosBrowser()), []);

  useEffect(() => startPwa(version), [version]);

  useEffect(() => {
    const open = () => setGuide(true);
    window.addEventListener("ytx-install-guide", open);
    return () => window.removeEventListener("ytx-install-guide", open);
  }, []);

  useEffect(() => {
    if ((mode !== "prompt" && mode !== "ios") || dismissedRecently()) return setVisible(false);
    const t = setTimeout(() => setVisible(true), Number(new URLSearchParams(location.search).get("installDelay") ?? SHOW_AFTER_MS));
    return () => clearTimeout(t);
  }, [mode]);

  const dismiss = () => {
    rememberDismissal();
    setVisible(false);
  };

  if (guide)
    return (
      <div className="install-card" role="dialog" aria-label="Install YoniXTools on iPhone or iPad">
        <button type="button" className="icon-button install-close" aria-label="Close" onClick={() => setGuide(false)}><X aria-hidden /></button>
        <strong>Add YoniXTools to your Home Screen</strong>
        <ol className="install-steps">
          <li>Tap <Share aria-label="Share" className="inline-icon" /> <b>Share</b> {SHARE_WHERE[browser]}.</li>
          <li>Scroll and tap <SquarePlus aria-hidden className="inline-icon" /> <b>Add to Home Screen</b>.</li>
          <li>Tap <b>Add</b>. YoniXTools opens full screen from its icon.</li>
        </ol>
        {browser === "other" && <p className="muted install-note">If you don&apos;t see it, open this page in Safari and follow the same steps.</p>}
      </div>
    );

  if (!visible) return null;
  return (
    <div className="install-card" role="dialog" aria-label="Install YoniXTools" data-testid="install-card">
      <button type="button" className="icon-button install-close" aria-label="Not now" onClick={dismiss}><X aria-hidden /></button>
      <img src="/icons/icon-192.png" alt="" width={44} height={44} className="install-icon" />
      <div className="install-text">
        <strong>Install YoniXTools</strong>
        <span>Open the downloader and every tool from your home screen, full screen, with faster repeat visits.</span>
      </div>
      <div className="install-actions">
        {mode === "prompt" ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => promptInstall().then(() => setVisible(false))}>
            <Download aria-hidden /> Install
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setVisible(false); setGuide(true); }}>
            How to install
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={dismiss}>Not now</button>
      </div>
    </div>
  );
}

/** Drawer entry: only rendered when installing is really possible in this browser. */
export function InstallMenuItem() {
  const mode = useInstallMode();
  if (mode !== "prompt" && mode !== "ios") return null;
  return (
    <button type="button" className="drawer-install" onClick={() => (mode === "prompt" ? void promptInstall() : window.dispatchEvent(new Event("ytx-install-guide")))}>
      <Download aria-hidden /> Install the app
    </button>
  );
}
