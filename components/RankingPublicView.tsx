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
    S: "bg-gradient-to-r from-purple-500 to-purple-400",
    A: "bg-gradient-to-r from-emerald-500 to-emerald-400",
    B: "bg-gradient-to-r from-sky-500 to-sky-400",
    C: "bg-gradient-to-r from-amber-500 to-amber-400",
    D: "bg-gradient-to-r from-rose-500 to-rose-400",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold text-white shadow",
        colorMap[tier ?? ""] ?? "bg-slate-500",
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

  const firstItems = useMemo(() => (Array.isArray(data.result?.items) ? data.result.items.slice(0, 5) : []), [data.result]);

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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-sky-50 to-emerald-50 pb-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pt-16">
        <header className="rounded-3xl border border-white/60 bg-white/60 p-8 shadow-xl backdrop-blur dark:border-slate-800/50 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span className="rounded-full bg-white/70 px-3 py-1 shadow">{data.category ?? "カテゴリー未設定"}</span>
                <span>{publishedDate}</span>
                <span>{data.counts.views} Views</span>
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">{data.title}</h1>
              {data.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600 dark:text-slate-200">
                  {data.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 shadow-sm">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-white/70 bg-white/60 px-4 py-3 shadow backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
              <button
                onClick={() => toggleReaction("like")}
                className={clsx(
                  "flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold transition",
                  liked ? "bg-rose-500 text-white shadow" : "bg-white/80 text-rose-500 hover:bg-rose-50",
                )}
              >
                ♥ {likeCount}
              </button>
              <button
                onClick={() => toggleReaction("bookmark")}
                className={clsx(
                  "flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold transition",
                  bookmarked ? "bg-emerald-500 text-white shadow" : "bg-white/80 text-emerald-600 hover:bg-emerald-50",
                )}
              >
                ♡ {bookmarkCount}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="prose max-w-none text-slate-700 prose-p:leading-relaxed dark:prose-invert">
              {data.summary ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{data.summary}</ReactMarkdown>
              ) : (
                <p className="text-sm text-slate-500">説明はまだ追加されていません。</p>
              )}
            </div>
            <aside className="space-y-4 rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
              <div className="flex items-center gap-3">
                <img
                  src={data.author.profile?.avatarUrl ?? data.author.image ?? "https://www.gravatar.com/avatar?d=mp"}
                  alt=""
                  className="h-12 w-12 rounded-full border border-white/70 shadow"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{authorDisplay}</div>
                  {authorHandle ? (
                    <Link href={`/u/${authorHandle}`} className="text-xs text-sky-600 underline">
                      @{authorHandle}
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-500">プロフィール設定未完了</span>
                  )}
                </div>
              </div>
              <div className="space-y-2 text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => window.open(shareUrls.x, "_blank")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  🐦 Xで共有
                </button>
                <button
                  type="button"
                  onClick={() => window.open(shareUrls.line, "_blank")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  💬 LINEで共有
                </button>
                <button
                  type="button"
                  onClick={() => copyShare(shareUrls.copy)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  🔗 リンクをコピー
                </button>
                {shareCopied && <div className="text-center text-xs text-emerald-600">リンクをコピーしました！</div>}
                <div className="space-y-2 text-xs">
                  <div className="font-semibold text-slate-600">埋め込みコード</div>
                  <textarea
                    value={embedCode}
                    readOnly
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600"
                    rows={3}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <button
                    type="button"
                    onClick={() => copyEmbed(embedCode)}
                    className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    {embedCopied ? "コピーしました" : "埋め込みコードをコピー"}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </header>

        {firstItems.length > 0 && (
          <section className="grid gap-4 rounded-3xl border border-purple-200/60 bg-white/70 p-6 shadow-lg backdrop-blur dark:border-purple-600/30 dark:bg-slate-900/70 lg:grid-cols-5">
            {firstItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/70 bg-white/80 p-4 text-center shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70">
                <TierBadge tier={item.tier} />
                <div className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{item.id}</div>
                <div className="mt-1 text-xs text-slate-500">{(item.score ?? 0).toFixed(2)} score</div>
              </div>
            ))}
          </section>
        )}

        <section className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/70">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">結果ビュー</h2>
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
          <div className="mt-6 min-h-[520px] rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-inner dark:border-slate-700/60 dark:bg-slate-900/70">
            <ResultTabs data={data.result} tab={tab} items={data.items} metrics={data.metrics} />
          </div>
        </section>
      </div>
    </div>
  );
}
