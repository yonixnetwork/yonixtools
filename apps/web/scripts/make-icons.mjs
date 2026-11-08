// Renders the app icons (PNG) from the logo with Chromium. Run: node scripts/make-icons.mjs
import { chromium } from "@playwright/test";
const mark = (stroke) => `<path d="M9 8l7 8 7-8M16 16v9" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
// "any": rounded square like the favicon. "maskable": full-bleed background, mark inside the 80% safe zone.
const any = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0e1014"/>${mark("#fff")}</svg>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#0e1014"/><g transform="translate(16 16) scale(0.72) translate(-16 -16.5)">${mark("#fff")}</g></svg>`;
const jobs = [["icon-192.png", any, 192], ["icon-512.png", any, 512], ["maskable-512.png", maskable, 512], ["maskable-192.png", maskable, 192], ["apple-touch-icon.png", maskable, 180]];
const b = await chromium.launch();
const p = await b.newPage();
for (const [name, svg, size] of jobs) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await p.screenshot({ path: `public/icons/${name}`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
// Wide/narrow screenshots aren't generated here (optional for installability).
await b.close();
console.log("icons written");
