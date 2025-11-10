import { Suspense } from "react";
import NavBar from "@/components/NavBar";
import { getDefaultProject } from "@/lib/project";
import { CreatePageClient } from "./CreatePageClient";

export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const project = await getDefaultProject();
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        <Suspense fallback={<div />}>
          <CreatePageClient projectSlug={project?.slug} />
        </Suspense>
      </main>
    </div>
  );
}
