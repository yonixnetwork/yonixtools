import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { AD_ISOLATION } from "@/lib/ads/config";

export const metadata: Metadata = {
  title: "Ad delivery check",
  robots: { index: false, follow: false },
  alternates: { canonical: "/ads-check/" },
};

// Not linked anywhere. Open it on a real phone or computer (not through a VPN or
// an ad blocker) to see whether each Adsterra unit delivers, in both isolation modes.
// Ad servers refuse datacenter IPs, so this can't be verified from a server.
export default function AdsCheck() {
  const units = ["banner320x50", "banner300x250", "banner728x90", "native"] as const;
  return (
    <div className="container" style={{ maxWidth: 900, paddingBottom: 48 }}>
      <h1 style={{ fontSize: "1.6rem", margin: "24px 0 8px" }}>Ad delivery check</h1>
      <p className="muted">
        Each unit is shown in both isolation modes. Under each one, the state reads <b>loading</b>, then <b>filled</b> (an ad rendered) or <b>empty</b> (nothing within
        about 9 seconds: ad blocker, no ad available, or the mode doesn&apos;t work). The site currently uses <b>{AD_ISOLATION}</b>.
      </p>
      {(["sandboxed", "same-origin"] as const).map((mode) => (
        <section key={mode} style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: "1.15rem" }}>Mode: {mode}</h2>
          {units.map((u) => (
            <AdSlot key={u + mode} unit={u} isolation={mode} debug className={u === "native" ? "ad-native" : undefined} />
          ))}
        </section>
      ))}
    </div>
  );
}
