import { RootDocument } from "@/components/RootDocument";
import { rootMetadata, rootViewport } from "@/lib/root-metadata";

// Root layout of the English pages at their original URLs (/, /tools/, /category/…, /guides/…, /about/, /privacy/, /offline/).
export const metadata = rootMetadata;
export const viewport = rootViewport;

export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument locale="en">{children}</RootDocument>;
}
