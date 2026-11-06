export interface Crumb {
  name: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <ol>
        {items.map((c, i) => (
          <li key={c.name}>{c.href && i < items.length - 1 ? <a href={c.href}>{c.name}</a> : <span aria-current="page">{c.name}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}
