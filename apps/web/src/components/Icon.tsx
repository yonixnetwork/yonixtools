import {
  AlignLeft, Binary, Bot, Braces, Calculator, CalendarDays, CaseSensitive, Code, Contact, Diff, Download, Fingerprint, Hash,
  HeartPulse, Image, KeyRound, Landmark, Link, Link2, Lock, Minimize2, Percent, QrCode, RefreshCw, Regex, Ruler, Scaling,
  Search, Tags, TrendingUp, Type, Wifi, type LucideIcon,
} from "lucide-react";
import { siFacebook, siInstagram, siPinterest, siReddit, siTiktok, siVimeo, siX, siYoutube } from "simple-icons";
import type { ToolCardData } from "@/lib/registry/cards";

const ICONS: Record<string, LucideIcon> = {
  AlignLeft, Binary, Bot, Braces, Calculator, CalendarDays, CaseSensitive, Code, Contact, Diff, Download, Fingerprint, Hash,
  HeartPulse, Image, KeyRound, Landmark, Link, Link2, Lock, Minimize2, Percent, QrCode, RefreshCw, Regex, Ruler, Scaling,
  Search, Tags, TrendingUp, Type, Wifi,
};

export function Icon({ name, ...props }: { name: string; className?: string; "aria-hidden"?: boolean }) {
  const C = ICONS[name] ?? Code;
  return <C aria-hidden {...props} />;
}

const BRANDS = { instagram: siInstagram, tiktok: siTiktok, youtube: siYoutube, facebook: siFacebook, x: siX, pinterest: siPinterest, reddit: siReddit, vimeo: siVimeo } as const;
// Black marks would vanish in dark mode; they follow the text colour instead.
const MONO = new Set(["tiktok", "x"]);

export function PlatformIcon({ platform, title }: { platform: string; title?: string }) {
  const icon = BRANDS[platform as keyof typeof BRANDS];
  if (!icon) return <Download aria-hidden />;
  return (
    <svg viewBox="0 0 24 24" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title} fill={MONO.has(platform) ? "currentColor" : `#${icon.hex}`}>
      <path d={icon.path} />
    </svg>
  );
}

export const PLATFORM_LIST = Object.keys(BRANDS);

export function ToolIcon({ tool, size }: { tool: Pick<ToolCardData, "icon" | "platform">; size?: "lg" }) {
  return (
    <span className={`tool-icon${tool.platform ? " brand-icon" : ""}${size ? ` ${size}` : ""}`}>
      {tool.platform ? <PlatformIcon platform={tool.platform} /> : <Icon name={tool.icon} />}
    </span>
  );
}
