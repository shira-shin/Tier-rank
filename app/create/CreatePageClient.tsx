"use client";

import { useSearchParams } from "next/navigation";
import ScoreForm from "@/components/ScoreForm";

type CreatePageClientProps = {
  projectSlug?: string;
};

export function CreatePageClient({ projectSlug }: CreatePageClientProps) {
  const searchParams = useSearchParams();
  const searchProjectSlug = searchParams.get("project")?.trim() || undefined;

  return (
    <ScoreForm projectSlug={projectSlug} searchProjectSlug={searchProjectSlug} />
  );
}
