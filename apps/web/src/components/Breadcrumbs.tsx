export interface Crumb {
  name: string;
  href?: string;
}

/** label: the translated "Breadcrumb" landmark name. */
export function Breadcrumbs({ items, label = "Breadcrumb" }: { items: Crumb[]; label?: string }) {
  return (
    <nav aria-label={label} className="breadcrumbs">
      <ol>
        {items.map((c, i) => (
          <li key={c.name}>{c.href && i < items.length - 1 ? <a href={c.href}>{c.name}</a> : <span aria-current="page">{c.name}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}
