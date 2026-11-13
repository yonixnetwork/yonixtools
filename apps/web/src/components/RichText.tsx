import { Fragment } from "react";

/** Renders text with [link text](/internal/path/) links. Only same-site paths become links. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\(\/[^)\s]*\))/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[([^\]]+)\]\((\/[^)\s]*)\)$/);
        return m ? (
          <a key={i} href={m[2]} className="link">
            {m[1]}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        );
      })}
    </>
  );
}
