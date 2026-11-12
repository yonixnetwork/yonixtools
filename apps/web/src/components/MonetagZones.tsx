import { AdSlot } from "@/components/AdSlot";
import { monetagAllowed, type MonetagPage } from "@/lib/ads/monetag-policy";

/**
 * Monetag In-Page Push on an allowed utility page, in an isolated frame on the ad
 * origin (like the Adsterra units). Renders nothing on media-URL pages (central rule)
 * or when Monetag/ads are off.
 */
export function MonetagZones({ page, desktopOnly }: { page: MonetagPage; desktopOnly?: boolean }) {
  if (!monetagAllowed(page)) return null;
  return <AdSlot unit="monetagPush" className={`ad-monetagPush${desktopOnly ? " ad-desktop-only" : ""}`} />;
}
