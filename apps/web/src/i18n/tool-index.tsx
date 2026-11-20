"use client";
/**
 * Tool names, taglines and links in the page's language, for client components that list or
 * search tools (search box, all-tools explorer, recommendations). English pages pass nothing and
 * use the registry and the English paths.
 */
import { createContext, useContext, type ReactNode } from "react";
import type { LocalizedToolText } from "@/lib/search";
import { toolPath } from "@/lib/site";

export interface ToolIndexData {
  text?: LocalizedToolText;
  /** slug → localized path */
  href?: Record<string, string>;
  /** Path of the all-tools page in this language. */
  toolsPath: string;
  /** Category id → localized name. */
  categoryNames?: Record<string, string>;
}

const Ctx = createContext<ToolIndexData>({ toolsPath: "/tools/" });

export function ToolIndexProvider({ value, children }: { value: ToolIndexData; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useToolIndex() {
  const v = useContext(Ctx);
  return {
    ...v,
    hrefOf: (slug: string) => v.href?.[slug] ?? toolPath(slug),
    textOf: <T extends { slug: string; name: string; tagline: string }>(tool: T): T => {
      const l = v.text?.[tool.slug];
      return l ? { ...tool, name: l.name, tagline: l.tagline } : tool;
    },
    categoryName: (id: string, fallback: string) => v.categoryNames?.[id] ?? fallback,
  };
}
