import NavBar from "@/components/NavBar";
import ScoreForm from "@/components/ScoreForm";
import { getDefaultProject } from "@/lib/project";

export default async function CreatePage() {
  const project = await getDefaultProject();
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        <ScoreForm projectSlug={project?.slug} />
      </main>
    </div>
  );
}
