import type { Faq } from "@/lib/registry";

export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="faq">
      {faqs.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <div>
            <p>{f.a}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
