import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGuide, guides } from "@/lib/guides";
import { GuideView, guideMetadata } from "@/views/ContentViews";

export const dynamicParams = false;
export const generateStaticParams = () => guides.map((g) => ({ slug: g.slug }));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug;
  return getGuide(slug) ? guideMetadata("en", slug) : {};
}

export default async function GuidePage({ params }: Props) {
  const slug = (await params).slug;
  if (!getGuide(slug)) notFound();
  return <GuideView locale="en" slug={slug} />;
}
