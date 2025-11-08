import NavBar from "@/components/NavBar";
import ScoreForm from "@/components/ScoreForm";

export default function CreatePage() {
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        <ScoreForm />
      </main>
    </div>
  );
}
