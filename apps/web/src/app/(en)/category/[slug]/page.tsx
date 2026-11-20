import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categories, getCategoryBySlug } from "@/lib/registry";
import { CategoryView, categoryMetadata } from "@/views/ListingViews";

export const dynamicParams = false;
export const generateStaticParams = () => categories.map((c) => ({ slug: c.slug }));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = getCategoryBySlug((await params).slug);
  return c ? categoryMetadata("en", c.id) : {};
}

export default async function CategoryPage({ params }: Props) {
  const c = getCategoryBySlug((await params).slug);
  if (!c) notFound();
  return <CategoryView locale="en" id={c.id} />;
}
