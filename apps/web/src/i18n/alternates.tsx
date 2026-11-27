"use client";
/**
 * The current page's path in every built language. Each page renders <PageAlternates map={…}/>
 * (computed at build time); the language selector reads it to open the equivalent page.
 */
import { useEffect } from "react";

let current: Record<string, string> = {};
const listeners = new Set<() => void>();

export const getAlternates = () => current;
export function subscribeAlternates(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function setAlternates(map: Record<string, string>) {
  current = map;
  listeners.forEach((l) => l());
}

export function PageAlternates({ map }: { map: Record<string, string> }) {
  useEffect(() => setAlternates(map), [map]);
  return null;
}
