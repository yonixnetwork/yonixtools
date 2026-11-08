import Script from "next/script";
import { guardedSnippet, MONETAG_ENABLED, MONETAG_ZONES, type MonetagZoneId } from "@/lib/ads/monetag";

/**
 * Loads the Monetag Vignette and In-Page Push zones on an eligible page, once,
 * after the page has finished loading (lazyOnload), so the tools are interactive
 * first. Monetag decides when and where the formats show (dashboard settings).
 */
export function MonetagZones() {
  if (!MONETAG_ENABLED) return null;
  return (
    <>
      {(Object.keys(MONETAG_ZONES) as MonetagZoneId[]).map((id) => (
        <Script key={id} id={`monetag-${MONETAG_ZONES[id].zone}`} strategy="lazyOnload" dangerouslySetInnerHTML={{ __html: guardedSnippet(id) }} />
      ))}
    </>
  );
}
