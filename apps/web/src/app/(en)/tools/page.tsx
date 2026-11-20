import { ToolsView, toolsMetadata } from "@/views/ListingViews";

export const metadata = toolsMetadata("en");
export default function ToolsPage() {
  return <ToolsView locale="en" />;
}
