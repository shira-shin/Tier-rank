"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import ResultReport from "@/components/ResultReport";
import type { AgentResult, ItemInput, MetricInput, ScoreResponse, TierResult } from "@/lib/types";
import { buildRankingUrl, buildShareUrls } from "@/lib/share";
import { buildReportSummary } from "@/lib/report";

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

function clampScore(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function convertAgentResultToScoreResponse(
  result: AgentResult | undefined,
  items: ItemInput[],
): ScoreResponse | undefined {
  const evaluated = (result?.items ?? []).filter((item) => item.id);
  if (evaluated.length === 0) return undefined;

  const nameMap = new Map(items.map((item) => [item.id, item.name ?? item.id]));

  const scores: ScoreResponse["scores"] = evaluated.map((entry) => {
    const breakdown = Object.entries(entry.contrib ?? {}).map(([key, score]) => ({
      key,
      score: clampScore(score),
      weight: 1,
      reason: entry.reason ?? "主要指標",
    }));
    const sortedCriteria = [...breakdown]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 3)
      .map((item) => item.key);

    return {
      id: entry.id,
      name: nameMap.get(entry.id) ?? entry.id,
      total_score: clampScore(entry.score),
      tier: (entry.tier ?? "").toUpperCase() || "その他",
      main_reason: entry.reason,
      top_criteria: sortedCriteria,
      criteria_breakdown: breakdown,
      sources: (entry.sources ?? []).map((source) => ({
        url: source.url,
        title: source.title ?? source.url,
      })),
      risk_notes: entry.risk_notes,
    };
  });

  const tierOrder = ["S", "A", "B", "C", "D", "E", "F", "その他"];
  const tierMap = new Map<string, TierResult>();

  scores.forEach((entry) => {
    const label = entry.tier && tierOrder.includes(entry.tier) ? entry.tier : "その他";
    if (!tierMap.has(label)) {
      tierMap.set(label, { label, items: [] });
    }
    tierMap.get(label)?.items.push({
      id: entry.id,
      name: entry.name,
      score: entry.total_score,
      main_reason: entry.main_reason,
      top_criteria: entry.top_criteria,
    });
  });

  const tiers = Array.from(tierMap.values()).sort(
    (a, b) => tierOrder.indexOf(a.label) - tierOrder.indexOf(b.label),
  );

  return { scores, tiers };
}

export default function RankingPublicView({ data }: RankingPublicViewProps) {
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

  const viewRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const scoreResponse = useMemo(
    () => convertAgentResultToScoreResponse(data.result, data.items),
    [data.result, data.items],
  );
  const summary = useMemo(
    () => buildReportSummary(data.result, data.items, data.metrics),
    [data.result, data.items, data.metrics],
  );

  const publishedDate = new Date(data.createdAt).toLocaleDateString();
  const authorHandle = data.author.profile?.handle;
  const authorDisplay = data.author.profile?.display ?? data.author.name ?? data.author.email ?? "匿名ユーザー";

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

  const actionSlot = (
    <div className="space-y-5 text-slate-600 dark:text-slate-200">
      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        {[
          { label: "Views", value: data.counts.views.toLocaleString(), accent: "text-sky-600" },
          { label: "Likes", value: likeCount.toLocaleString(), accent: "text-rose-600" },
          { label: "Bookmarks", value: bookmarkCount.toLocaleString(), accent: "text-emerald-600" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-slate-900/50"
          >
            <p className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">{stat.label}</p>
            <p className={clsx("font-display text-2xl font-bold", stat.accent)}>{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">共有</p>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => window.open(shareUrls.x, "_blank")}
            className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-gradient-to-r hover:from-[#e0f2fe] hover:to-[#ede9fe] dark:border-white/10 dark:bg-slate-900/60 dark:text-white"
          >
            🐦 Xで共有
            <span aria-hidden>↗</span>
          </button>
          <button
            type="button"
            onClick={() => window.open(shareUrls.line, "_blank")}
            className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-gradient-to-r hover:from-[#bbf7d0] hover:to-[#99f6e4] dark:border-white/10 dark:bg-slate-900/60 dark:text-white"
          >
            💬 LINEで共有
            <span aria-hidden>↗</span>
          </button>
          <button
            type="button"
            onClick={() => copyShare(shareUrls.copy)}
            className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-gradient-to-r hover:from-[#ddd6fe] hover:to-[#f5d0fe] dark:border-white/10 dark:bg-slate-900/60 dark:text-white"
          >
            🔗 リンクをコピー
            <span aria-hidden>⧉</span>
          </button>
        </div>
        {shareCopied && <div className="text-xs font-semibold text-emerald-500">リンクをコピーしました</div>}
      </div>
      <div className="space-y-2 text-xs">
        <div className="text-sm font-semibold text-slate-500 dark:text-slate-200">埋め込みコード</div>
        <textarea
          value={embedCode}
          readOnly
          rows={4}
          className="w-full rounded-2xl border border-slate-200/80 bg-white/70 p-3 text-[11px] text-slate-600 shadow-inner focus:outline-none dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
          onFocus={(event) => event.currentTarget.select()}
        />
        <button
          type="button"
          onClick={() => copyEmbed(embedCode)}
          className="w-full rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-gradient-to-r hover:from-[#fee2e2] hover:to-[#fef9c3] dark:border-white/10 dark:bg-slate-900/60 dark:text-white"
        >
          {embedCopied ? "コピーしました" : "埋め込みコードをコピー"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black pb-16 text-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pt-12">
        <header className="rounded-[40px] border border-white/10 bg-slate-900/60 p-8 shadow-[0_0_60px_rgba(15,118,110,0.35)] backdrop-blur-2xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/90">
                  {data.category ?? "カテゴリー未設定"}
                </span>
                <span>{publishedDate}</span>
              </div>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white md:text-4xl">{data.title}</h1>
              {data.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-300">
                  {data.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-white/80">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white shadow-lg backdrop-blur">
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
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2.4fr)_minmax(0,0.9fr)]">
            <div className="prose max-w-none text-slate-200 prose-headings:text-white prose-p:leading-relaxed">
              {data.summary ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{data.summary}</ReactMarkdown>
              ) : (
                <p className="text-sm text-slate-400">説明はまだ追加されていません。</p>
              )}
            </div>
            <aside className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-200 shadow-xl">
              <div className="flex items-center gap-4">
                <img
                  src={data.author.profile?.avatarUrl ?? data.author.image ?? "https://www.gravatar.com/avatar?d=mp"}
                  alt=""
                  className="h-14 w-14 rounded-full border border-white/20 shadow-lg"
                />
                <div>
                  <p className="text-base font-semibold text-white">{authorDisplay}</p>
                  {authorHandle ? (
                    <Link href={`/u/${authorHandle}`} className="text-xs text-cyan-300 underline">
                      @{authorHandle}
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400">プロフィール設定未完了</span>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-slate-300">
                <p className="font-semibold uppercase tracking-[0.3em] text-slate-400">Ranking ID</p>
                <p className="truncate text-lg font-semibold text-white">{data.slug}</p>
              </div>
            </aside>
          </div>
        </header>

        {scoreResponse ? (
          <ResultReport
            response={scoreResponse}
            items={data.items}
            metrics={data.metrics}
            summary={summary}
            onBack={() => {}}
            onOpenPublish={() => {}}
            publishDisabled
            onExportJSON={() => {}}
            onExportCSV={() => {}}
            onExportPNG={() => {}}
            onExportPDF={() => {}}
            onExportDocx={() => {}}
            viewRef={viewRef}
            reportRef={reportRef}
            actionSlot={actionSlot}
          />
        ) : (
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-10 text-center text-slate-300">
            <p>公開された評価結果が見つかりませんでした。</p>
          </div>
        )}
      </div>
    </div>
  );
}
