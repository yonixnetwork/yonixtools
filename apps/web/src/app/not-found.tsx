import { SearchBox } from "@/components/SearchBox";

export default function NotFound() {
  return (
    <div className="container empty" style={{ padding: "80px 16px" }}>
      <h1 style={{ fontSize: "2rem" }}>Page not found</h1>
      <p>That page doesn&apos;t exist. Try searching for the tool you need.</p>
      <div style={{ maxWidth: 480, margin: "24px auto 0" }}>
        <SearchBox size="lg" />
      </div>
      <p style={{ marginTop: 20 }}>
        <a href="/" className="link">Go to the homepage</a>
      </p>
    </div>
  );
}
