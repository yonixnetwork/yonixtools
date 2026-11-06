export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Clamp a crop rectangle to the image and enforce a minimum size. All values in image pixels. */
export function clampRect(r: Rect, imgW: number, imgH: number, min = 1): Rect {
  const w = Math.max(min, Math.min(Math.round(r.w), imgW));
  const h = Math.max(min, Math.min(Math.round(r.h), imgH));
  const x = Math.max(0, Math.min(Math.round(r.x), imgW - w));
  const y = Math.max(0, Math.min(Math.round(r.y), imgH - h));
  return { x, y, w, h };
}

/** Largest centred rectangle with the given aspect ratio (w/h) that fits the image. */
export function centeredAspect(imgW: number, imgH: number, aspect: number | null): Rect {
  if (!aspect) return { x: 0, y: 0, w: imgW, h: imgH };
  let w = imgW;
  let h = Math.round(w / aspect);
  if (h > imgH) {
    h = imgH;
    w = Math.round(h * aspect);
  }
  return { x: Math.round((imgW - w) / 2), y: Math.round((imgH - h) / 2), w, h };
}

/** Resize a rect from a corner drag while keeping an optional aspect ratio. */
export function resizeFromCorner(start: Rect, dx: number, dy: number, corner: "nw" | "ne" | "sw" | "se", aspect: number | null, imgW: number, imgH: number): Rect {
  let { x, y, w, h } = start;
  const sx = corner.includes("e") ? 1 : -1;
  const sy = corner.includes("s") ? 1 : -1;
  w = start.w + sx * dx;
  h = start.h + sy * dy;
  if (aspect) {
    if (Math.abs(dx) > Math.abs(dy)) h = w / aspect;
    else w = h * aspect;
  }
  w = Math.max(8, w);
  h = Math.max(8, h);
  if (sx < 0) x = start.x + start.w - w;
  if (sy < 0) y = start.y + start.h - h;
  // Keep inside the image, preserving aspect when clamping.
  if (x < 0) {
    w += x;
    x = 0;
    if (aspect) h = w / aspect;
  }
  if (y < 0) {
    h += y;
    y = 0;
    if (aspect) w = h * aspect;
  }
  if (x + w > imgW) {
    w = imgW - x;
    if (aspect) h = w / aspect;
  }
  if (y + h > imgH) {
    h = imgH - y;
    if (aspect) w = h * aspect;
  }
  return clampRect({ x, y, w, h }, imgW, imgH, 8);
}
