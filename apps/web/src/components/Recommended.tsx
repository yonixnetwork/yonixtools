"use client";
import { useEffect, useState } from "react";
import { ToolCard } from "./ToolCard";
import { getRecent } from "@/lib/recent";
import { relatedCards, type ToolCardData } from "@/lib/registry/cards";

/**
 * "Recommended for you": tools related to what this visitor used recently
 * (stored only in their browser). New visitors see editor's picks. There is
 * no analytics yet, so nothing here claims to be "trending".
 */
export function Recommended({ cards, picks }: { cards: ToolCardData[]; picks: string[] }) {
  const by = new Map(cards.map((c) => [c.slug, c]));
  const fallback = picks.map((s) => by.get(s)!).filter(Boolean);
  const [state, setState] = useState<{ title: string; note: string; tools: ToolCardData[]; recent: ToolCardData[] }>({ title: "Editor's picks", note: "Handy tools people often miss.", tools: fallback, recent: [] });

  useEffect(() => {
    const recent = getRecent().map((s) => by.get(s)).filter((t): t is ToolCardData => !!t);
    if (!recent.length) return;
    const seen = new Set(recent.map((t) => t.slug));
    const recs: ToolCardData[] = [];
    for (const t of recent) for (const r of relatedCards(t.slug, cards, 6)) if (!seen.has(r.slug) && r.status === "live" && recs.length < 4) (seen.add(r.slug), recs.push(r));
    for (const t of fallback) if (!seen.has(t.slug) && recs.length < 4) recs.push(t);
    setState({ title: "Recommended for you", note: "Based on tools you used recently on this device.", tools: recs, recent: recent.slice(0, 4) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {state.recent.length > 0 && (
        <section className="section" aria-labelledby="recent-h">
          <div className="container">
            <div className="section-head">
              <div>
                <h2 id="recent-h">Recently used</h2>
                <p>Pick up where you left off.</p>
              </div>
            </div>
            <div className="tool-grid cols-4">
              {state.recent.map((t) => <ToolCard key={t.slug} tool={t} />)}
            </div>
          </div>
        </section>
      )}
      <section className="section" aria-labelledby="rec-h">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 id="rec-h">{state.title}</h2>
              <p>{state.note}</p>
            </div>
          </div>
          <div className="tool-grid cols-4">
            {state.tools.map((t) => <ToolCard key={t.slug} tool={t} />)}
          </div>
        </div>
      </section>
    </>
  );
}
