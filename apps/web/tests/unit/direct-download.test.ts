import { afterEach, describe, expect, it, vi } from "vitest";
import { jobPhase, phaseText } from "@/lib/downloader/phases";
import { randomToken, startBrowserDownload, withParam } from "@/lib/downloader/browser-download";
import { readPreferredFormat, savePreferredFormat } from "@/lib/downloader/history";

describe("download phases", () => {
  it("maps backend jobs to honest phases", () => {
    expect(jobPhase({ status: "queued", phase: "queued" })).toBe("queued");
    expect(jobPhase({ status: "running", phase: "downloading" })).toBe("downloading");
    expect(jobPhase({ status: "running", phase: "processing" })).toBe("processing");
    expect(jobPhase({ status: "running" })).toBe("downloading"); // older backend
    expect(jobPhase({ status: "queued" })).toBe("queued");
  });
  it("labels phases", () => {
    expect(phaseText({ phase: "downloading", progress: 41.6 })).toBe("Downloading 42%");
    expect(phaseText({ phase: "downloading", progress: 0 })).toBe("Downloading…");
    expect(phaseText({ phase: "started" })).toBe("Download started");
    expect(phaseText({ phase: "requested" })).toBe("Download requested");
  });
});

type FakeAnchor = { href: string; download: string; rel: string; style: Record<string, string>; click: () => void; remove: () => void };

function fakeDom(origin: string, onClick: (a: FakeAnchor) => void) {
  const jar = new Map<string, string>();
  const document = {
    get cookie() {
      return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    set cookie(v: string) {
      const [pair] = v.split(";");
      const [k, val] = pair.split("=");
      if (/Max-Age=0/i.test(v)) jar.delete(k.trim());
      else jar.set(k.trim(), val);
    },
    createElement: () => {
      const a: FakeAnchor = { href: "", download: "", rel: "", style: {}, click: () => onClick(a), remove: () => {} };
      return a;
    },
    body: { appendChild: () => {} },
  };
  vi.stubGlobal("document", document);
  vi.stubGlobal("location", { href: `${origin}/`, origin });
  return { jar, document };
}

describe("startBrowserDownload", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports 'started' only once the server's cookie for this token arrives", async () => {
    let clicked = "";
    const { document } = fakeDom("https://yonixtools.com", (a) => {
      clicked = a.href;
      const token = new URL(a.href, "https://yonixtools.com").searchParams.get("dl")!;
      setTimeout(() => (document.cookie = `ytx_dl_${token}=1; Path=/`), 300);
    });
    const head = vi.fn(async () => new Response(null, { status: 200 }));
    const r = await startBrowserDownload("/api/v1/jobs/abc/file", { fetchImpl: head as unknown as typeof fetch, timeoutMs: 3000 });
    expect(r).toBe("started");
    expect(head).toHaveBeenCalledWith("/api/v1/jobs/abc/file", expect.objectContaining({ method: "HEAD" }));
    expect(clicked).toMatch(/^\/api\/v1\/jobs\/abc\/file\?dl=[a-z0-9]{8,32}$/);
    expect(document.cookie).toBe(""); // cleaned up
  });

  it("never claims 'started' without the cookie", async () => {
    fakeDom("https://yonixtools.com", () => {});
    const r = await startBrowserDownload("/api/v1/jobs/abc/file", { fetchImpl: (async () => new Response(null, { status: 200 })) as unknown as typeof fetch, timeoutMs: 600 });
    expect(r).toBe("requested");
  });

  it("does not trigger a download for an expired or missing file", async () => {
    const click = vi.fn();
    fakeDom("https://yonixtools.com", click);
    await expect(startBrowserDownload("/api/f", { fetchImpl: (async () => new Response(null, { status: 410 })) as unknown as typeof fetch })).rejects.toThrow(/expired/);
    await expect(startBrowserDownload("/api/f", { fetchImpl: (async () => new Response(null, { status: 404 })) as unknown as typeof fetch })).rejects.toThrow(/isn't available/);
    expect(click).not.toHaveBeenCalled();
  });

  it("builds tokens and query strings safely", () => {
    expect(randomToken()).toMatch(/^[a-z0-9]{8,32}$/);
    expect(withParam("/f", "dl", "abc")).toBe("/f?dl=abc");
    expect(withParam("/f?x=1", "dl", "abc")).toBe("/f?x=1&dl=abc");
  });
});

describe("remembered quality (no history is kept)", () => {
  afterEach(() => vi.unstubAllGlobals());
  const memStorage = () => {
    const m = new Map<string, string>();
    return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  };

  it("remembers only known quality ids, clears the old history key, survives blocked storage", () => {
    const st = memStorage();
    st.setItem("ytx-history", JSON.stringify([{ title: "old" }]));
    vi.stubGlobal("localStorage", st);
    savePreferredFormat("v:720");
    expect(readPreferredFormat()).toBe("v:720");
    expect(st.m.has("ytx-history")).toBe(false);
    savePreferredFormat("javascript:alert(1)");
    savePreferredFormat("i:best~png");
    expect(readPreferredFormat()).toBe("v:720");
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } });
    expect(readPreferredFormat()).toBeNull();
    expect(() => savePreferredFormat("v:720")).not.toThrow();
  });
});

describe("cross-origin API (local development)", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("can't observe the cookie, so it reports 'requested'", async () => {
    fakeDom("http://localhost:3000", () => {});
    const r = await startBrowserDownload("http://localhost:8787/v1/jobs/a/file", { fetchImpl: (async () => new Response(null, { status: 200 })) as unknown as typeof fetch });
    expect(r).toBe("requested");
  });
});
