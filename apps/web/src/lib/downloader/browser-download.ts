/**
 * Start a file download in the browser without a second click, and report
 * honestly whether the browser actually began receiving it.
 *
 * 1. HEAD request: make sure the file still exists (never trigger a broken download).
 * 2. Programmatic click on an <a download> pointing at the attachment URL: the
 *    browser saves the file and the page does not navigate.
 * 3. The server sets a short-lived cookie `ytx_dl_<token>` on the file response;
 *    seeing it means the response headers reached the browser, i.e. the
 *    download really started. (Only possible same-origin, as in production.)
 */
export type DownloadStart = "started" | "requested";

export function randomToken(): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16).toLowerCase();
}

function hasCookie(name: string) {
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${name}=`));
}

function clearCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; Path=/`;
}

export function withParam(url: string, key: string, value: string) {
  return `${url}${url.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

export async function startBrowserDownload(fileUrl: string, opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}): Promise<DownloadStart> {
  const f = opts.fetchImpl ?? fetch;
  const head = await f(fileUrl, { method: "HEAD", cache: "no-store" });
  if (head.status === 410) throw new Error("This download has expired. Choose the quality again to prepare it once more.");
  if (!head.ok) throw new Error("The file isn't available any more. Choose the quality again.");

  const token = randomToken();
  const cookie = `ytx_dl_${token}`;
  const a = document.createElement("a");
  a.href = withParam(fileUrl, "dl", token);
  a.download = "";
  a.rel = "noopener";
  // Clicked while detached from the page: the click event never reaches page-level
  // listeners (e.g. third-party ad scripts), so nothing can intercept a download.
  a.click();

  const sameOrigin = new URL(fileUrl, location.href).origin === location.origin;
  if (!sameOrigin) return "requested"; // can't observe the cookie cross-origin (local development only)
  const deadline = Date.now() + (opts.timeoutMs ?? 20_000);
  while (Date.now() < deadline) {
    if (hasCookie(cookie)) {
      clearCookie(cookie);
      return "started";
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return "requested";
}
