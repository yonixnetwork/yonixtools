import { Fragment } from "react";

/** Renders text with [link text](/internal/path/) links. Only same-site paths become links. */
/** href: maps an internal path to the page language's path (defaults to unchanged). */
export function RichText({ text, href = (h) => h }: { text: string; href?: (path: string) => string }) {
  const parts = text.split(/(\[[^\]]+\]\(\/[^)\s]*\))/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[([^\]]+)\]\((\/[^)\s]*)\)$/);
        return m ? (
          <a key={i} href={href(m[2])} className="link">
            {m[1]}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        );
      })}
    </>
  );
}
