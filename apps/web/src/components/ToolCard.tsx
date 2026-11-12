import { Clock } from "lucide-react";
import { ToolIcon } from "./Icon";
import { toolPath } from "@/lib/site";
import type { ToolCardData } from "@/lib/registry/cards";
import { isAvailable } from "@/lib/registry/availability";

export function StatusBadge({ tool }: { tool: Pick<ToolCardData, "status"> }) {
  if (!isAvailable(tool))
    return (
      <span className="badge badge-pending">
        <Clock aria-hidden /> Coming soon
      </span>
    );
  return null;
}

export function ToolCard({ tool, headingLevel = 3 }: { tool: ToolCardData; headingLevel?: 2 | 3 }) {
  const H = `h${headingLevel}` as "h2" | "h3";
  return (
    <a className="tool-card" href={toolPath(tool.slug)}>
      <ToolIcon tool={tool} />
      <div style={{ minWidth: 0 }}>
        <H>{tool.name}</H>
        <p>{tool.tagline}</p>
        <StatusBadge tool={tool} />
      </div>
    </a>
  );
}
