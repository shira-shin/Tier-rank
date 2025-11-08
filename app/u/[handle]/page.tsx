import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";

export const revalidate = 120;

export default async function ProfilePage({ params }: { params: { handle: string } }) {
  const profile = await prisma.profile.findUnique({
    where: { handle: params.handle },
    include: {
      user: {
        include: {
          rankings: {
            where: { visibility: "PUBLIC" },
            orderBy: { createdAt: "desc" },
            include: { _count: { select: { likes: true, bookmarks: true } } },
          },
        },
      },
    },
  });

  if (!profile) {
    notFound();
  }

  const links = profile.links as { twitter?: string; github?: string; site?: string } | null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 pb-16">
      <div className="mx-auto max-w-5xl px-4 pt-16">
        <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-xl backdrop-blur">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/30 via-sky-500/30 to-emerald-500/30" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
            <img
              src={profile.avatarUrl ?? "https://www.gravatar.com/avatar?d=mp"}
              alt=""
              className="h-24 w-24 rounded-full border-4 border-white/50 shadow-2xl"
            />
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-white">{profile.display}</h1>
              <p className="text-slate-200">@{profile.handle}</p>
              {profile.bio && <p className="max-w-2xl text-sm text-slate-200/80">{profile.bio}</p>}
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-200/80">
                {links?.twitter && (
                  <a href={links.twitter} target="_blank" rel="noreferrer" className="rounded-full border border-white/40 px-3 py-1 hover:bg-white/20">
                    Twitter
                  </a>
                )}
                {links?.github && (
                  <a href={links.github} target="_blank" rel="noreferrer" className="rounded-full border border-white/40 px-3 py-1 hover:bg-white/20">
                    GitHub
                  </a>
                )}
                {links?.site && (
                  <a href={links.site} target="_blank" rel="noreferrer" className="rounded-full border border-white/40 px-3 py-1 hover:bg-white/20">
                    Website
                  </a>
                )}
              </div>
            </div>
          </div>
        </header>

        <section className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {profile.user.rankings.map((ranking) => (
            <Link
              key={ranking.id}
              href={`/r/${ranking.slug}`}
              className="group overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-lg transition hover:-translate-y-1 hover:border-emerald-400/60 hover:shadow-emerald-500/20"
            >
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>{new Date(ranking.createdAt).toLocaleDateString()}</span>
                <span>♥ {ranking._count.likes}</span>
              </div>
              <h2 className="mt-3 line-clamp-2 text-lg font-semibold text-white group-hover:text-emerald-300">{ranking.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm text-slate-200/80">{ranking.summary ?? "説明はありません"}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-emerald-200/80">
                {ranking.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-emerald-400/40 px-2 py-0.5">#{tag}</span>
                ))}
              </div>
            </Link>
          ))}
          {profile.user.rankings.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-200/70">
              まだ公開されたランキングはありません。
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
