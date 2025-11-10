import { getServerSession } from "next-auth";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import ScoreForm from "@/components/ScoreForm";
import { authOptions } from "@/lib/auth";
import { getDefaultProject } from "@/lib/project";

export default async function Page() {
  const [session, defaultProject] = await Promise.all([
    getServerSession(authOptions),
    getDefaultProject(),
  ]);
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-sky-100 via-white to-emerald-100 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">AIティア表を作成して共有しましょう</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            スコアリングした結果を公開し、みんなのランキングで反応を集められます。プロフィールやOG画像も自動生成されます。
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/70 px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
            >
              みんなのランキングを見る →
            </Link>
            <Link
              href="/settings/profile"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-100/70 px-4 py-2 font-semibold text-emerald-700 transition hover:bg-emerald-200/70 dark:border-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200"
            >
              プロフィールを整える →
            </Link>
          </div>
        </section>
        {!session && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-sm">
            ログインしていません。Googleでサインインすると、保存や共有などの機能を有効化できます。
          </div>
        )}
        <ScoreForm projectSlug={defaultProject?.slug} />
      </main>
    </div>
  );
}
