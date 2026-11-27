import { HomeView, homeMetadata } from "@/views/HomeView";

export const metadata = homeMetadata("en");
export default function Home() {
  return <HomeView locale="en" />;
}
