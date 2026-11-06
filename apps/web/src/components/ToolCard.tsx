import { Clock } from "lucide-react";
import { ToolIcon } from "./Icon";
import { toolPath } from "@/lib/site";
import type { ToolCardData } from "@/lib/registry/cards";

export function StatusBadge({ tool }: { tool: Pick<ToolCardData, "status"> }) {
  if (tool.status === "awaiting-backend")
    return (
      <span className="badge badge-pending" title="Interface and link detection work; downloading goes live when the backend is deployed.">
        <Clock aria-hidden /> Backend coming soon
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
