import Link from "next/link";
import prisma from "@/lib/prisma";

const SORTS = [
  { value: "new", label: "新着" },
  { value: "hot", label: "Hot" },
  { value: "top", label: "人気" },
];

export const revalidate = 60;

function buildQueryString(params: Record<string, string | undefined>, overrides: Record<string, string | undefined>) {
  const merged = { ...params, ...overrides };
  const query = Object.entries(merged)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(value ?? "")}`)
    .join("&");
  return query ? `?${query}` : "";
}

export default async function ExplorePage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const sort = searchParams.sort ?? "new";
  const tag = searchParams.tag;
  const q = searchParams.q;

  const where: Record<string, unknown> = { visibility: "PUBLIC" };
  if (tag) {
    where.tags = { has: tag };
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { summary: { contains: q, mode: "insensitive" } },
      { tags: { has: q } },
    ];
  }

  let orderBy: any = { createdAt: "desc" };
  if (sort === "top") {
    orderBy = [{ likes: { _count: "desc" } }, { createdAt: "desc" }];
  } else if (sort === "hot") {
    orderBy = [{ views: "desc" }, { updatedAt: "desc" }];
  }

  const rankings = await prisma.ranking.findMany({
    where,
    take: 36,
    orderBy,
    include: {
      author: { include: { profile: true } },
      _count: { select: { likes: true, bookmarks: true } },
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pb-16">
      <div className="mx-auto max-w-6xl px-4 pt-16">
        <header className="mb-10 flex flex-col gap-6 rounded-3xl border border-white/60 bg-white/70 p-8 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/60">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">みんなのランキング</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">新着・人気のティア表を探索しましょう。カテゴリやタグで絞り込みできます。</p>
          </div>
          <form className="flex flex-wrap items-center gap-3" action="/explore">
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="キーワード検索"
              className="flex-1 min-w-[200px] rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-900"
            />
            {tag && <input type="hidden" name="tag" value={tag} />}
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow hover:from-sky-600 hover:to-emerald-600"
            >
              検索
            </button>
          </form>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {SORTS.map((entry) => {
              const query = buildQueryString(searchParams, { sort: entry.value });
              const active = sort === entry.value;
              return (
                <Link
                  key={entry.value}
                  href={`/explore${query}`}
                  className={active ? "rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white" : "rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"}
                >
                  {entry.label}
                </Link>
              );
            })}
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rankings.map((ranking) => {
            const author = ranking.author.profile?.display ?? ranking.author.name ?? ranking.author.email ?? "匿名";
            const previewItems = (() => {
              const result = ranking.resultJson as any;
              if (Array.isArray(result?.items)) {
                return result.items.slice(0, 3) as any[];
              }
              return [] as any[];
            })();
            return (
              <article
                key={ranking.id}
                className="group overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-lg transition hover:-translate-y-1 hover:shadow-2xl dark:border-slate-700 dark:bg-slate-900/80"
              >
                <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-purple-500 via-sky-500 to-emerald-500">
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-950/40 to-slate-900/20" />
                  <div className="absolute bottom-3 left-3 flex gap-2">
                    {previewItems.map((item: any) => (
                      <span key={item.id} className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 shadow">
                        {item.tier ?? "-"} {item.id}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">{ranking.category ?? "カテゴリ"}</span>
                    <span>{new Date(ranking.createdAt).toLocaleDateString()}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900 transition group-hover:text-sky-600 dark:text-white">{ranking.title}</h2>
                  <p className="line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{ranking.summary ?? "説明はありません"}</p>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{author}</span>
                    <span>♥ {ranking._count.likes}</span>
                  </div>
                  <Link
                    href={`/r/${ranking.slug}`}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                  >
                    詳細を見る →
                  </Link>
                </div>
              </article>
            );
          })}
          {rankings.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
              条件に一致するランキングが見つかりませんでした。
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
