"use client";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { dismissedRecently, installMode, iosBrowser, promptInstall, rememberDismissal, startPwa, subscribe, type InstallMode, type IosBrowser } from "@/lib/pwa";

const SHOW_AFTER_MS = 12_000; // never on arrival: only once the visitor has been here a moment

/** Where the Share button is, per iOS browser (keys in common: install.shareWhere.*). */
const SHARE_WHERE: Record<IosBrowser, string> = { safari: "safari", chrome: "chrome", edge: "edge", firefox: "firefox", other: "other" };

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
  const t = useT("common");
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
      <div className="install-card" role="dialog" aria-label={t("install.iosDialog")}>
        <button type="button" className="icon-button install-close" aria-label={t("install.close")} onClick={() => setGuide(false)}><X aria-hidden /></button>
        <strong>{t("install.iosTitle")}</strong>
        <ol className="install-steps">
          <li>{t.rich("install.iosStep1", { icon: () => <Share aria-label={t("install.share")} className="inline-icon" />, b: (c) => <b>{c}</b> }, { where: t(`install.shareWhere.${SHARE_WHERE[browser]}`) })}</li>
          <li>{t.rich("install.iosStep2", { icon: () => <SquarePlus aria-hidden className="inline-icon" />, b: (c) => <b>{c}</b> })}</li>
          <li>{t.rich("install.iosStep3", { b: (c) => <b>{c}</b> })}</li>
        </ol>
        {browser === "other" && <p className="muted install-note">{t("install.iosOther")}</p>}
      </div>
    );

  if (!visible) return null;
  return (
    <div className="install-card" role="dialog" aria-label={t("install.dialog")} data-testid="install-card">
      <button type="button" className="icon-button install-close" aria-label={t("install.notNow")} onClick={dismiss}><X aria-hidden /></button>
      <img src="/icons/icon-192.png" alt="" width={44} height={44} className="install-icon" />
      <div className="install-text">
        <strong>{t("install.title")}</strong>
        <span>{t("install.text")}</span>
      </div>
      <div className="install-actions">
        {mode === "prompt" ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => promptInstall().then(() => setVisible(false))}>
            <Download aria-hidden /> {t("install.install")}
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setVisible(false); setGuide(true); }}>
            {t("install.how")}
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={dismiss}>{t("install.notNow")}</button>
      </div>
    </div>
  );
}

/** Drawer entry: only rendered when installing is really possible in this browser. */
export function InstallMenuItem() {
  const t = useT("common");
  const mode = useInstallMode();
  if (mode !== "prompt" && mode !== "ios") return null;
  return (
    <button type="button" className="drawer-install" onClick={() => (mode === "prompt" ? void promptInstall() : window.dispatchEvent(new Event("ytx-install-guide")))}>
      <Download aria-hidden /> {t("install.menu")}
    </button>
  );
}
