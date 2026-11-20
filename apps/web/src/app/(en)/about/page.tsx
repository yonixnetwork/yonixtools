import { AboutView, aboutMetadata } from "@/views/ContentViews";

export const metadata = aboutMetadata("en");
export default function About() {
  return <AboutView locale="en" />;
}
