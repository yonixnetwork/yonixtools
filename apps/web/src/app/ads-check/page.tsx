import type { Metadata } from "next";
import { AdsCheck } from "./AdsCheck";

export const metadata: Metadata = {
  title: "Ad delivery check",
  robots: { index: false, follow: false },
  alternates: { canonical: "/ads-check/" },
};

// Not linked anywhere. Open it on a real phone or computer (no VPN) to see whether
// each Adsterra unit delivers. Ad servers treat datacenter and automated traffic
// differently, so real delivery can only be confirmed from a real device.
export default function AdsCheckPage() {
  return (
    <div className="container" style={{ maxWidth: 900, paddingBottom: 48 }}>
      <h1 style={{ fontSize: "1.6rem", margin: "24px 0 8px" }}>Ad delivery check</h1>
      <p className="muted">
        Scroll to the bottom so every unit loads, wait about 15 seconds, then tap <b>Copy report</b> and send it. Each unit reads <b>loading</b>, then{" "}
        <b>AD RENDERED</b> or <b>EMPTY</b> with the reason: script blocked, script errors (integration problem), or script ran with no ad returned (fill or unit
        approval). Please don&apos;t click the ads.
      </p>
      <AdsCheck />
    </div>
  );
}
