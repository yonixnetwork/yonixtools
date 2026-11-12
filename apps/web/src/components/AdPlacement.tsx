import { AdSlot } from "@/components/AdSlot";
import { monetagAllowed, type MonetagPage } from "@/lib/ads/monetag-policy";
import { placementsFor, type Placement, type PageType } from "@/lib/ads/placements";

/**
 * A named ad position on a page. What (if anything) appears here is decided by the
 * central table in lib/ads/placements.ts. Device limits are CSS-only (a hidden slot
 * never loads); Monetag positions also pass the central Monetag policy, and are never
 * used on the homepage or downloader pages whatever the table says.
 */
export function AdPlacement({ page, position, monetag, className }: { page: PageType; position: string; monetag?: MonetagPage; className?: string }) {
  const list = placementsFor(page, position).filter((p) => p.network !== "monetag" || (page !== "home" && page !== "downloader" && !!monetag && monetagAllowed(monetag)));
  if (!list.length) return null;
  return (
    <>
      {list.map((p) => (
        <AdSlot key={p.id} placement={p.id} {...unitProps(p)} className={[deviceClass(p), formatClass(p), className].filter(Boolean).join(" ")} />
      ))}
    </>
  );
}

function unitProps(p: Placement) {
  return p.format === "leaderboard" ? { responsive: "leaderboard" as const } : { unit: p.format };
}
function formatClass(p: Placement) {
  return p.format === "native" ? "ad-native" : p.format === "monetagPush" ? "ad-monetagPush" : "";
}
function deviceClass(p: Placement) {
  const m = p.devices.includes("mobile"), d = p.devices.includes("desktop");
  return m && d ? "" : d ? "ad-wide-only" : m ? "ad-narrow-only" : "ad-off";
}
