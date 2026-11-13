import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
  alternates: { canonical: "/offline/" },
};

// Shown by the service worker when a page isn't available without a connection.
export default function Offline() {
  return (
    <div className="container" style={{ maxWidth: 640, padding: "56px 16px", textAlign: "center" }}>
      <h1 style={{ fontSize: "1.8rem" }}>You&apos;re offline</h1>
      <p className="muted" style={{ marginTop: 12 }}>
        This page needs a connection. Pages you opened before still work offline, and tools that run in your browser keep working once loaded. Downloading from
        social platforms needs a connection.
      </p>
      <p style={{ marginTop: 20 }}>
        <a className="btn btn-primary" href="/">Try again</a>
      </p>
    </div>
  );
}
