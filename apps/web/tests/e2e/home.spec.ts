import { expect, test } from "@playwright/test";

test("homepage structure", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/YoniXTools/);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toContainText("Download from any social platform");
  for (const h of ["Popular tools", "Browse by category", "Recently added", "Editor's picks", "Why use YoniXTools", "Frequently asked questions"]) {
    await expect(page.getByRole("main").getByRole("heading", { name: h, exact: true })).toBeVisible();
  }
  await expect(page.locator("footer")).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://yonixtools.com/");
});

test.describe("universal downloader (no backend configured)", () => {
  test.beforeEach(async ({ page }) => {
    const goto = page.goto.bind(page);
    page.goto = async (url, opts) => {
      const r = await goto(url, opts);
      await page.locator("html[data-downloader-ready]").waitFor({ state: "attached" });
      return r;
    };
  });
  test("detects the platform as you type", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("#dl-url");
    await input.fill("https://www.instagram.com/reel/C9xAbCdEfGh/");
    await expect(page.locator("#dl-detect")).toContainText("Instagram · Reel detected");
    await input.fill("Look https://youtube.com/shorts/abcdEFGhijk");
    await expect(page.locator("#dl-detect")).toContainText("YouTube · Short detected");
    await input.fill("https://vm.tiktok.com/ZMabc123/");
    await expect(page.locator("#dl-detect")).toContainText("TikTok · Short link detected");
  });

  test("never reports a successful download when the backend is not deployed", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.goto("/");
    await expect(page.getByTestId("dl-status")).toContainText("Downloading turns on when the YoniXTools download service launches");
    await page.locator("#dl-url").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await page.getByRole("button", { name: "Download", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Downloading is not live yet" })).toBeVisible();
    await expect(page.getByText("Nothing was downloaded.")).toBeVisible();
    await expect(page.getByText(/Save file|ready|success/i)).toHaveCount(0);
    expect(requests.filter((u) => !u.startsWith("http://localhost:4173"))).toEqual([]);
  });

  test("explains unsupported and unsafe links", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("#dl-url");
    const submit = page.getByRole("button", { name: "Download", exact: true });
    await input.fill("https://www.instagram.com/stories/someone/123/");
    await submit.click();
    await expect(page.locator(".notice[role=alert]")).toContainText("Instagram link not supported");
    await expect(page.locator(".notice[role=alert]")).toContainText("Stories require logging in");
    await input.fill("http://127.0.0.1:8080/admin");
    await submit.click();
    await expect(page.locator(".notice[role=alert]")).toContainText("can't be used");
    await input.fill("https://example.com/video");
    await submit.click();
    await expect(page.locator(".notice[role=alert]")).toContainText("isn't a supported platform");
  });

  test("platform page accepts other platforms' links", async ({ page }) => {
    await page.goto("/instagram-downloader/");
    await expect(page.locator("#dl-url")).toHaveAttribute("placeholder", /Instagram/);
    await page.locator("#dl-url").fill("https://www.tiktok.com/@a/video/7350000000000000000");
    await expect(page.locator("#dl-detect")).toContainText("works here too");
  });
});

test.describe("search & discovery", () => {
  test("header search suggests and navigates", async ({ page }) => {
    await page.goto("/");
    const box = page.locator(".nav-search input");
    await box.click();
    await expect(page.locator(".suggest")).toContainText("Popular searches");
    await box.fill("insta");
    await expect(page.locator('.suggest [role="option"]').first()).toContainText("Instagram Downloader");
    await box.fill("pasword generater");
    await expect(page.locator('.suggest [role="option"]').first()).toContainText("Password Generator");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/password-generator\/$/);
  });

  test("slash shortcut focuses search", async ({ page }) => {
    await page.goto("/privacy/");
    await page.keyboard.press("/");
    await expect(page.locator(".nav-search input")).toBeFocused();
  });

  test("all-tools page: query string, planned tools, empty state, category filter", async ({ page }) => {
    await page.goto("/tools/?q=pdf%20compressor");
    await expect(page.getByText("PDF Compressor is planned but not available yet.")).toBeVisible();
    await expect(page.locator(".tool-card").first()).toContainText("Image Compressor");
    const input = page.getByRole("searchbox", { name: "Search tools" }).last();
    await input.fill("zzqxv blorpt");
    await expect(page.getByText("No tools match")).toBeVisible();
    await page.getByRole("button", { name: "JSON formatter" }).click();
    await expect(page.locator(".tool-card").first()).toContainText("JSON Formatter");
    await input.fill("");
    await page.getByRole("button", { name: /^Calculators/ }).click();
    await expect(page.getByTestId("result-count")).toHaveText("6 tools");
    await expect(page).toHaveURL(/category=calculators/);
  });

  test("recently used tools appear on the homepage", async ({ page }) => {
    await page.goto("/jwt-decoder/");
    await page.locator("html[data-visit-recorded=jwt-decoder]").waitFor({ state: "attached" });
    await page.goto("/bmi-calculator/");
    await page.locator("html[data-visit-recorded=bmi-calculator]").waitFor({ state: "attached" });
    await page.goto("/");
    const recent = page.locator('section[aria-labelledby="recent-h"]');
    await expect(recent).toContainText("BMI Calculator");
    await expect(recent).toContainText("JWT Decoder");
    await expect(page.getByRole("heading", { name: "Recommended for you" })).toBeVisible();
  });
});

test("theme toggle persists across reloads", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle light or dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(10, 11, 15)");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
