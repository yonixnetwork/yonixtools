import { GuidesView, guidesMetadata } from "@/views/ContentViews";

export const metadata = guidesMetadata("en");
export default function GuidesPage() {
  return <GuidesView locale="en" />;
}
