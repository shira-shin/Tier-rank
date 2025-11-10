"use client";

import { useSearchParams } from "next/navigation";
import { ScoreForm } from "@/components/ScoreForm";

export function CreatePageClient() {
  const searchParams = useSearchParams();
  const initialProjectSlug = searchParams.get("project")?.trim() || "demo";

  return <ScoreForm initialProjectSlug={initialProjectSlug} />;
}
