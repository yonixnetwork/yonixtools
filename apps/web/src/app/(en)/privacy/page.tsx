import { PrivacyView, privacyMetadata } from "@/views/ContentViews";

export const metadata = privacyMetadata("en");
export default function Privacy() {
  return <PrivacyView locale="en" />;
}
