import { OfflineView, offlineMetadata } from "@/views/ContentViews";

// Shown by the service worker when a page isn't available without a connection.
export const metadata = offlineMetadata("en");
export default function Offline() {
  return <OfflineView locale="en" />;
}
