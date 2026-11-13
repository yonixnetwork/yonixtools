"use client";
import { useEffect } from "react";
import { recordVisit } from "@/lib/recent";

export function VisitRecorder({ slug }: { slug: string }) {
  useEffect(() => {
    recordVisit(slug);
    document.documentElement.dataset.visitRecorded = slug;
  }, [slug]);
  return null;
}
