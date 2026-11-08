import Script from "next/script";
import { guardedSnippet, MONETAG_ZONES, type MonetagZoneId } from "@/lib/ads/monetag";
import { MONETAG_DENIED_PATHS, monetagAllowed, type MonetagPage } from "@/lib/ads/monetag-policy";

/**
 * Loads the Monetag Vignette and In-Page Push zones on an allowed page (see monetagAllowed), once,
 * after the page has finished loading (lazyOnload), so the tools are interactive
 * first. Monetag decides when and where the formats show (dashboard settings).
 */
export function MonetagZones({ page }: { page: MonetagPage }) {
  if (!monetagAllowed(page)) return null; // central rule: never on media-URL pages
  return (
    <>
      {(Object.keys(MONETAG_ZONES) as MonetagZoneId[]).map((id) => (
        <Script key={id} id={`monetag-${MONETAG_ZONES[id].zone}`} strategy="lazyOnload" dangerouslySetInnerHTML={{ __html: guardedSnippet(id, MONETAG_DENIED_PATHS) }} />
      ))}
    </>
  );
}
