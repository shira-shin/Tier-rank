import Link from "next/link";
import { Suspense } from "react";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import NavBar from "@/components/NavBar";
import { ScoreForm } from "@/components/ScoreForm";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

function HomeInputSkeleton() {
  return (
    <div className="space-y-4 rounded-[36px] border border-white/10 bg-slate-950/60 p-8">
      <div className="h-5 w-32 animate-pulse rounded-full bg-white/10" />
      <div className="h-10 w-3/4 animate-pulse rounded-2xl bg-white/10" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-32 animate-pulse rounded-3xl bg-white/5" />
        <div className="h-32 animate-pulse rounded-3xl bg-white/5" />
      </div>
      <div className="h-24 animate-pulse rounded-3xl bg-white/5" />
    </div>
  );
}

export default async function Page() {
  const session = await getServerSession(authOptions);
  const sevenDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);

  type RankingWithCounts = Prisma.RankingGetPayload<{
    include: { _count: { select: { likes: true; bookmarks: true } } };
  }>;

  const [publicCount, recentPublicCount, communityRankings] = await Promise.all([
    prisma.ranking.count({ where: { visibility: "PUBLIC" } }),
    prisma.ranking.count({ where: { visibility: "PUBLIC", createdAt: { gte: sevenDaysAgo } } }),
    prisma.ranking.findMany({
      where: { visibility: "PUBLIC" },
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        author: { include: { profile: true } },
        _count: { select: { likes: true, bookmarks: true } },
      },
    }),
  ]);

  let myRankings: RankingWithCounts[] = [];
  let myRankingCount = 0;
  if (session?.user?.id) {
    [myRankings, myRankingCount] = await Promise.all([
      prisma.ranking.findMany({
        where: { authorId: session.user.id },
        take: 4,
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { likes: true, bookmarks: true } } },
      }),
      prisma.ranking.count({ where: { authorId: session.user.id } }),
    ]);
  }

  const heroStats = [
    {
      label: "公開ランキング",
      value: publicCount.toLocaleString("ja-JP"),
      caption: "コミュニティ全体",
    },
    {
      label: "今週の追加",
      value: recentPublicCount.toLocaleString("ja-JP"),
      caption: "直近7日間",
    },
    {
      label: session ? "あなたの投稿" : "サインインで記録",
      value: session ? `${myRankingCount} 件` : "0 件",
      caption: session ? "保存済みのティア表" : "履歴を残して同期",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <NavBar />
      <main className="mx-auto w-full max-w-6xl space-y-16 px-4 py-10 sm:px-8">
        <section className="rounded-[48px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/80 to-slate-950 p-10 shadow-[0_50px_120px_rgba(0,0,0,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.6em] text-emerald-200">AI Tier Ranking Studio</p>
          <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">
            入力と結果のハブをホーム画面で完結
          </h1>
          <p className="mt-4 max-w-3xl text-base text-white/70">
            候補の入力、AI評価、公開されたランキングの確認を1画面で。お気に入りのティア表や自分の結果へすぐアクセスできるよう、ホームを再設計しました。
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="#input"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-6 py-3 text-lg font-semibold text-white shadow-lg transition hover:translate-y-0.5"
            >
              入力ホームに移動 ↘
            </Link>
            <Link
              href="#community"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-lg font-semibold text-white/90 transition hover:bg-white/10"
            >
              投稿フィードを見る
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-lg font-semibold text-white/80 transition hover:bg-white/10"
            >
              みんなのランキングへ →
            </Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {heroStats.map((stat) => (
              <div key={stat.label} className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white/80">
                <p className="text-xs uppercase tracking-[0.4em] text-white/60">{stat.caption}</p>
                <p className="mt-2 text-3xl font-black text-white">{stat.value}</p>
                <p className="text-sm text-white/70">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="input" className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.4em] text-emerald-300">Input Home</p>
              <h2 className="text-3xl font-black sm:text-4xl">AI入力ホーム</h2>
              <p className="text-base text-white/70">
                候補の入力からティア表の保存まで、スクロールを移動せずに作業できます。ナビゲーションボタンも大きくなり、迷わず評価に集中できます。
              </p>
            </div>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              全画面で開く ↗
            </Link>
          </div>
          <div className="rounded-[44px] border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950/70 to-black/60 p-4 shadow-[0_35px_90px_rgba(15,23,42,0.75)]">
            <Suspense fallback={<HomeInputSkeleton />}>
              <ScoreForm initialProjectSlug="demo" displayContext="home" />
            </Suspense>
          </div>
        </section>

        <section id="community" className="space-y-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.4em] text-sky-300">Community</p>
              <h2 className="text-3xl font-black sm:text-4xl">最新の投稿フィード</h2>
              <p className="text-base text-white/70">
                他の人のティア表と自分の結果を同じ画面で確認。タグやプレビューを表示し、気になる投稿へすぐジャンプできます。
              </p>
            </div>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              すべての投稿を表示 →
            </Link>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">みんなの最新投稿</h3>
                <span className="text-xs uppercase tracking-[0.4em] text-white/50">Public</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {communityRankings.map((ranking) => {
                  const author =
                    ranking.author.profile?.display ??
                    ranking.author.name ??
                    ranking.author.email ??
                    "匿名";
                  const result = ranking.resultJson as any;
                  const previewItems: { id: string; tier?: string }[] = Array.isArray(result?.items)
                    ? result.items.slice(0, 3)
                    : [];
                  return (
                    <article
                      key={ranking.id}
                      className="group flex h-full flex-col justify-between rounded-[32px] border border-white/10 bg-white/5 p-5 text-white shadow-[0_20px_45px_rgba(15,23,42,0.45)] transition hover:-translate-y-1"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/60">
                          <span>{ranking.category ?? "カテゴリ"}</span>
                          <span>{formatDate(ranking.createdAt)}</span>
                        </div>
                        <h3 className="text-2xl font-semibold leading-tight text-white">{ranking.title}</h3>
                        <p className="text-sm text-white/70">
                          {ranking.summary ?? "説明文はまだ入力されていません。"}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {ranking.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="rounded-full border border-white/20 px-3 py-1 text-white/80">
                              #{tag}
                            </span>
                          ))}
                          {previewItems.map((item) => (
                            <span key={item.id} className="rounded-full border border-white/20 px-3 py-1 text-white/70">
                              {item.tier ?? "-"} {item.id}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="mt-6 flex flex-col gap-3">
                        <div className="flex items-center justify-between text-xs text-white/70">
                          <span className="font-semibold text-white">{author}</span>
                          <div className="flex items-center gap-3">
                            <span>♥ {ranking._count.likes}</span>
                            <span>★ {ranking._count.bookmarks}</span>
                          </div>
                        </div>
                        <Link
                          href={`/r/${ranking.slug}`}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white"
                        >
                          投稿を開く →
                        </Link>
                      </div>
                    </article>
                  );
                })}
                {communityRankings.length === 0 && (
                  <div className="rounded-[32px] border border-dashed border-white/20 p-8 text-center text-sm text-white/70">
                    まだ公開されているランキングがありません。
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-4 rounded-[32px] border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">あなたの結果</h3>
                <span className="text-xs uppercase tracking-[0.4em] text-white/60">My Records</span>
              </div>
              {session ? (
                myRankings.length > 0 ? (
                  <div className="space-y-4">
                    {myRankings.map((ranking) => {
                      const visibilityText =
                        ranking.visibility === "PRIVATE"
                          ? "非公開"
                          : ranking.visibility === "UNLISTED"
                            ? "限定公開"
                            : "公開";
                      return (
                        <article key={ranking.id} className="rounded-3xl border border-white/10 bg-slate-950/60 p-4 shadow-inner">
                          <div className="flex items-center justify-between text-xs text-white/60">
                            <span>{visibilityText}</span>
                            <span>{formatDate(ranking.updatedAt)} 更新</span>
                          </div>
                          <h4 className="mt-2 text-lg font-semibold text-white">{ranking.title}</h4>
                          <p className="text-sm text-white/70">
                            {ranking.summary ?? "説明文はまだ入力されていません。"}
                          </p>
                          <div className="mt-3 flex items-center justify-between text-xs text-white/60">
                            <div className="flex flex-wrap gap-2">
                              <span>♥ {ranking._count.likes}</span>
                              <span>★ {ranking._count.bookmarks}</span>
                            </div>
                            <Link
                              href={`/r/${ranking.slug}`}
                              className="rounded-full border border-white/20 px-4 py-1 text-xs font-semibold text-white/80 transition hover:bg-white/10"
                            >
                              詳細を見る
                            </Link>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/20 p-6 text-sm text-white/70">
                    まだ投稿がありません。AI評価を実行して結果を保存すると、ここに履歴が表示されます。
                  </div>
                )
              ) : (
                <div className="space-y-3 rounded-3xl border border-white/15 bg-slate-950/60 p-6 text-sm text-white/80">
                  <p>ログインすると、自分のティア表と過去の結果がホームに表示されます。</p>
                  <Link
                    href="/create"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-white"
                  >
                    作成を始める
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
