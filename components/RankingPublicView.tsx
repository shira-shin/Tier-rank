"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import Segmented from "@/components/Segmented";
import ResultTabs, { type ViewTab } from "@/components/ResultTabs";
import type { AgentResult, ItemInput, MetricInput } from "@/lib/types";
import { buildRankingUrl, buildShareUrls } from "@/lib/share";

type RankingPublicViewProps = {
  data: {
    id: string;
    slug: string;
    title: string;
    summary?: string | null;
    category?: string | null;
    tags: string[];
    items: ItemInput[];
    metrics: MetricInput[];
    result: AgentResult;
    createdAt: string;
    author: {
      id: string;
      name?: string | null;
      image?: string | null;
      email?: string | null;
      profile?: {
        handle: string;
        display: string;
        bio?: string | null;
        avatarUrl?: string | null;
      } | null;
    };
    counts: {
      views: number;
      likes: number;
      bookmarks: number;
    };
    viewer: {
      liked: boolean;
      bookmarked: boolean;
    };
  };
};

function TierBadge({ tier }: { tier?: string | null }) {
  const colorMap: Record<string, string> = {
    S: "from-purple-500 to-fuchsia-500",
    A: "from-emerald-500 to-cyan-500",
    B: "from-sky-500 to-indigo-500",
    C: "from-amber-500 to-orange-500",
    D: "from-rose-500 to-red-500",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-[0_0_14px_rgba(16,185,129,0.35)]",
        tier ? `bg-gradient-to-r ${colorMap[tier] ?? "from-slate-500 to-slate-600"}` : undefined,
      )}
    >
      {tier ?? "-"}
    </span>
  );
}

export default function RankingPublicView({ data }: RankingPublicViewProps) {
  const [tab, setTab] = useState<ViewTab>("tier");
  const [liked, setLiked] = useState(data.viewer.liked);
  const [bookmarked, setBookmarked] = useState(data.viewer.bookmarked);
  const [likeCount, setLikeCount] = useState(data.counts.likes);
  const [bookmarkCount, setBookmarkCount] = useState(data.counts.bookmarks);
  const [shareCopied, setShareCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  const shareUrls = useMemo(() => buildShareUrls(data.slug, data.title), [data.slug, data.title]);
  const embedCode = useMemo(() => {
    const baseUrl = buildRankingUrl(data.slug).replace("/r/", "/embed/");
    return `<iframe src="${baseUrl}" width="640" height="480" style="border:none;border-radius:16px" loading="lazy"></iframe>`;
  }, [data.slug]);

  const rankedItems = useMemo(() => {
    if (!Array.isArray(data.result?.items)) return [];
    return [...data.result.items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [data.result]);

  const topThree = useMemo(() => rankedItems.slice(0, 3), [rankedItems]);

  async function toggleReaction(kind: "like" | "bookmark") {
    try {
      const response = await fetch(`/api/rankings/${data.slug}/${kind}`, { method: "POST" });
      const json = await response.json();
      if (kind === "like") {
        setLiked(Boolean(json.liked));
        if (typeof json.count === "number") setLikeCount(json.count);
      } else {
        setBookmarked(Boolean(json.bookmarked));
        if (typeof json.count === "number") setBookmarkCount(json.count);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function copyShare(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch (error) {
      console.error(error);
    }
  }

  async function copyEmbed(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setEmbedCopied(true);
      window.setTimeout(() => setEmbedCopied(false), 2000);
    } catch (error) {
      console.error(error);
    }
  }

  const publishedDate = new Date(data.createdAt).toLocaleDateString();
  const authorHandle = data.author.profile?.handle;
  const authorDisplay = data.author.profile?.display ?? data.author.name ?? data.author.email ?? "匿名ユーザー";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black pb-16 text-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pt-16">
        <header className="rounded-[32px] border border-white/10 bg-slate-900/70 p-8 shadow-[0_0_50px_rgba(15,118,110,0.35)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/90">
                  {data.category ?? "カテゴリー未設定"}
                </span>
                <span>{publishedDate}</span>
                <span>{data.counts.views} Views</span>
              </div>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white md:text-4xl">{data.title}</h1>
              {data.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-300">
                  {data.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-white/80">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white shadow-lg backdrop-blur">
              <button
                onClick={() => toggleReaction("like")}
                className={clsx(
                  "flex items-center gap-2 rounded-full px-3 py-1 transition",
                  liked
                    ? "bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white shadow"
                    : "border border-white/10 bg-white/5 text-rose-200 hover:bg-white/10",
                )}
              >
                ♥ {likeCount}
              </button>
              <button
                onClick={() => toggleReaction("bookmark")}
                className={clsx(
                  "flex items-center gap-2 rounded-full px-3 py-1 transition",
                  bookmarked
                    ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow"
                    : "border border-white/10 bg-white/5 text-emerald-200 hover:bg-white/10",
                )}
              >
                ♡ {bookmarkCount}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="prose max-w-none text-slate-200 prose-headings:text-white prose-p:leading-relaxed">
              {data.summary ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{data.summary}</ReactMarkdown>
              ) : (
                <p className="text-sm text-slate-400">説明はまだ追加されていません。</p>
              )}
            </div>
            <aside className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200 shadow-lg">
              <div className="flex items-center gap-3">
                <img
                  src={data.author.profile?.avatarUrl ?? data.author.image ?? "https://www.gravatar.com/avatar?d=mp"}
                  alt=""
                  className="h-12 w-12 rounded-full border border-white/20 shadow-lg"
                />
                <div>
                  <div className="text-sm font-semibold text-white">{authorDisplay}</div>
                  {authorHandle ? (
                    <Link href={`/u/${authorHandle}`} className="text-xs text-cyan-300 underline">
                      @{authorHandle}
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400">プロフィール設定未完了</span>
                  )}
                </div>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <button
                  type="button"
                  onClick={() => window.open(shareUrls.x, "_blank")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  🐦 Xで共有
                </button>
                <button
                  type="button"
                  onClick={() => window.open(shareUrls.line, "_blank")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  💬 LINEで共有
                </button>
                <button
                  type="button"
                  onClick={() => copyShare(shareUrls.copy)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  🔗 リンクをコピー
                </button>
                {shareCopied && <div className="text-center text-xs text-emerald-300">リンクをコピーしました！</div>}
                <div className="space-y-2 text-xs">
                  <div className="font-semibold text-slate-200">埋め込みコード</div>
                  <textarea
                    value={embedCode}
                    readOnly
                    className="w-full rounded-lg border border-white/10 bg-black/40 p-2 text-[11px] text-slate-200"
                    rows={3}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <button
                    type="button"
                    onClick={() => copyEmbed(embedCode)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                  >
                    {embedCopied ? "コピーしました" : "埋め込みコードをコピー"}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </header>

        {topThree.length > 0 && (
          <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.3),_transparent_60%)] p-8 text-white shadow-[0_0_60px_rgba(14,165,233,0.25)]">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end">
              <div className="flex-1 space-y-2">
                <p className="text-xs uppercase tracking-[0.4em] text-emerald-200">Top contenders</p>
                <h2 className="text-3xl font-black tracking-tight text-white">ランキング・アリーナ</h2>
                <p className="text-sm text-slate-200">スコアに応じた順位をビジュアルで表現。エネルギッシュなバーで一目で強さが伝わります。</p>
              </div>
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-slate-300">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold">
                  ⚡ Power Ranking
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold">
                  Tier Signal
                </span>
              </div>
            </div>
            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              {topThree.map((item, index) => {
                const visuals = [
                  {
                    accent: "from-amber-400/80 via-orange-500/80 to-rose-500/70",
                    border: "border-amber-300/40",
                    glow: "shadow-[0_0_40px_rgba(251,191,36,0.45)]",
                    label: "01",
                    icon: "🥇",
                  },
                  {
                    accent: "from-slate-200/70 via-slate-100/40 to-cyan-200/40",
                    border: "border-slate-200/40",
                    glow: "shadow-[0_0_40px_rgba(148,163,184,0.35)]",
                    label: "02",
                    icon: "🥈",
                  },
                  {
                    accent: "from-amber-600/50 via-orange-500/30 to-rose-600/30",
                    border: "border-amber-600/40",
                    glow: "shadow-[0_0_40px_rgba(234,179,8,0.35)]",
                    label: "03",
                    icon: "🥉",
                  },
                ][index];
                const scorePercent = Math.round(Math.max(0, Math.min(1, item.score ?? 0)) * 100);
                return (
                  <article
                    key={item.id}
                    className={clsx(
                      "relative overflow-hidden rounded-3xl border bg-white/5 p-6 backdrop-blur-lg transition hover:-translate-y-1",
                      visuals?.border,
                      visuals?.glow,
                    )}
                  >
                    <div
                      className="absolute inset-0 bg-gradient-to-br opacity-60"
                      style={{ backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(15,23,42,0.6))" }}
                    />
                    <div className="relative flex items-start justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.4em] text-slate-200">Rank {visuals?.label}</p>
                        <div className="mt-2 text-2xl font-black text-white">{item.id}</div>
                        <div className="mt-1 text-xs text-slate-300">{item.name ?? item.id}</div>
                      </div>
                      <div className="flex flex-col items-end text-right">
                        <span className="text-4xl font-black text-white">{scorePercent}%</span>
                        <TierBadge tier={item.tier} />
                      </div>
                    </div>
                    <div className="relative mt-4">
                      <div className="h-3 rounded-full bg-white/10">
                        <div
                          className={clsx("h-3 rounded-full bg-gradient-to-r", visuals?.accent ?? "from-emerald-400 to-cyan-400")}
                          style={{ width: `${scorePercent}%` }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                        <span>{visuals?.icon} エネルギーレベル</span>
                        <span className="font-semibold text-white">{scorePercent} / 100</span>
                      </div>
                    </div>
                    {item.reason && (
                      <p className="relative mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">{item.reason}</p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_0_50px_rgba(15,118,110,0.35)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-emerald-200">Insight modes</p>
              <h2 className="text-xl font-semibold text-white">結果ビュー</h2>
            </div>
            <Segmented<ViewTab>
              value={tab}
              onChange={setTab}
              options={[
                { label: "Tier表", value: "tier" },
                { label: "ランキング", value: "rank" },
                { label: "カード", value: "cards" },
                { label: "レーダー", value: "radar" },
                { label: "JSON", value: "json" },
              ]}
            />
          </div>
          <div className="mt-6 min-h-[520px] rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-inner">
            <ResultTabs data={data.result} tab={tab} items={data.items} metrics={data.metrics} />
          </div>
        </section>
      </div>
    </div>
  );
}
