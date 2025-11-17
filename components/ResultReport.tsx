"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MutableRefObject,
  type RefObject,
  type SVGProps,
} from "react";
import clsx from "clsx";
import type { ItemInput, MetricInput, ScoreResponse } from "@/lib/types";
import type { ReportSummary } from "@/lib/report";

function formatPercent(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function getReadableDomain(url?: string | null) {
  if (!url) return null;
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function clampProgress(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function TierBadge({ tier, className }: { tier?: string; className?: string }) {
  const map: Record<string, string> = {
    S: "from-[#f97316] via-[#fb7185] to-[#f472b6]",
    A: "from-[#34d399] via-[#22d3ee] to-[#818cf8]",
    B: "from-[#fbbf24] via-[#f59e0b] to-[#f97316]",
    C: "from-[#fb7185] via-[#f43f5e] to-[#c026d3]",
  };

  return (
    <span
      className={clsx(
        "inline-flex min-w-[3rem] items-center justify-center rounded-full bg-gradient-to-r px-4 py-1.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(0,0,0,0.18)]",
        map[tier ?? ""] ?? "from-slate-500 to-slate-400",
        className,
      )}
    >
      {tier ?? "-"}
    </span>
  );
}

type IconProps = SVGProps<SVGSVGElement>;

function IconSparkles(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path
        d="M12 2.5 13.7 7h4.8l-3.9 2.8 1.5 4.7L12 13.7 7.9 14.5l1.5-4.7L5.5 7h4.8L12 2.5Z"
        fill="currentColor"
      />
      <path d="M5 16.5 5.8 18.8 8 19.6 5.8 20.4 5 22.7 4.2 20.4 2 19.6 4.2 18.8 5 16.5Z" fill="currentColor" />
      <path d="M18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" fill="currentColor" />
    </svg>
  );
}

function IconShield(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M12 3 5 6v5c0 4.2 3 8 7 9.5 4-1.5 7-5.3 7-9.5V6l-7-3Z" />
      <path d="M12 9v4" />
      <circle cx={12} cy={16.5} r={0.8} fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconDocument(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M7 3h7l5 5v13H7c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2Z" />
      <path d="M14 3v6h6" />
      <path d="M9 13h6" />
      <path d="M9 17h3" />
    </svg>
  );
}

function IconLink(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M10 7H7a4 4 0 0 0 0 8h3" />
      <path d="M14 7h3a4 4 0 0 1 0 8h-3" />
      <path d="M8 12h8" />
    </svg>
  );
}

function IconCrown(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M3.5 8.5 6.5 19h11L20.5 8.5l-4 3-4.5-6-4.5 6-4-3Z" />
      <path d="M9 19c0 1.5 1.5 2.5 3 2.5s3-1 3-2.5" />
    </svg>
  );
}

function IconRadar(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <circle cx={12} cy={12} r={9} />
      <path d="M12 12 19 5" />
      <circle cx={12} cy={12} r={3} />
      <circle cx={17} cy={7} r={0.9} fill="currentColor" stroke="none" />
    </svg>
  );
}

type ScoreEntry = ScoreResponse["scores"][number];
type TierEntry = ScoreResponse["tiers"][number];

type ResultReportProps = {
  response: ScoreResponse;
  items: ItemInput[];
  metrics: MetricInput[];
  summary?: ReportSummary;
  onBack: () => void;
  onOpenPublish: () => void;
  publishDisabled?: boolean;
  onExportJSON: () => void;
  onExportCSV: () => void;
  onExportPNG: () => void;
  onExportPDF: () => void;
  onExportDocx: () => void;
  viewRef: RefObject<HTMLDivElement>;
  reportRef: RefObject<HTMLDivElement>;
};

export function ResultReport({
  response,
  items,
  metrics,
  summary,
  onBack,
  onOpenPublish,
  publishDisabled,
  onExportJSON,
  onExportCSV,
  onExportPNG,
  onExportPDF,
  onExportDocx,
  viewRef,
  reportRef,
}: ResultReportProps) {
  const sortedScores = useMemo(
    () => [...response.scores].sort((a, b) => b.total_score - a.total_score),
    [response.scores],
  );
  const [selectedId, setSelectedId] = useState<string | null>(sortedScores[0]?.id ?? null);
  const [viewMode, setViewMode] = useState<"ranking" | "tier">("ranking");
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  useEffect(() => {
    const top = sortedScores[0];
    if (!top) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => (prev && sortedScores.some((entry) => entry.id === prev) ? prev : top.id));
  }, [sortedScores]);

  const nameMap = useMemo(() => new Map(items.map((item) => [item.id, item.name ?? item.id])), [items]);
  const metricMap = useMemo(() => new Map(metrics.map((metric) => [metric.name, metric])), [metrics]);

  const selected = useMemo(
    () => sortedScores.find((entry) => entry.id === selectedId) ?? sortedScores[0],
    [sortedScores, selectedId],
  );

  const tierOrder = useMemo(() => response.tiers.map((tier) => tier.label), [response.tiers]);

  const summaryLine = useMemo(() => {
    const top = sortedScores[0];
    if (!top) return "評価結果を確認してください。";
    return `トップは ${top.name} (Tier ${top.tier} / ${formatPercent(top.total_score)})`;
  }, [sortedScores]);

  const assignViewRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!viewRef) return;
      (viewRef as MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [viewRef],
  );

  const assignReportRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!reportRef) return;
      (reportRef as MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [reportRef],
  );

  const [jsonOpen, setJsonOpen] = useState(false);

  const topCandidate = sortedScores[0];
  const topProgress = clampProgress(topCandidate?.total_score);
  const summarySections = summary?.sections ?? [];
  const visibleSummarySections = summaryExpanded ? summarySections : summarySections.slice(0, 1);
  const hasHiddenSummary = summarySections.length > visibleSummarySections.length;

  return (
    <div
      ref={assignViewRef}
      className="relative overflow-hidden rounded-[40px] border border-white/40 bg-gradient-to-br from-[#0b1220] via-[#101b3a] to-[#0a0f1e] p-[1px] shadow-[0_30px_80px_rgba(15,23,42,0.55)]"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 20%, rgba(124, 58, 237, 0.35), transparent 40%), radial-gradient(circle at 80% 0%, rgba(59, 130, 246, 0.3), transparent 45%), radial-gradient(circle at 50% 80%, rgba(16, 185, 129, 0.25), transparent 50%)",
        }}
      />
      <div className="relative space-y-8 rounded-[38px] bg-white/95 p-6 text-slate-900 backdrop-blur-xl dark:bg-slate-950/70 dark:text-slate-100">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,0.9fr)]">
          <section className="relative overflow-hidden rounded-[32px] border border-white/60 bg-gradient-to-r from-[#6228d7] via-[#a855f7] to-[#f97316] p-[1px] shadow-[0_30px_60px_rgba(107,33,168,0.4)]">
            <div className="relative flex flex-col gap-6 rounded-[30px] bg-slate-950/70 p-6 text-white backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">最新サマリー</p>
                  <p className="font-display text-3xl font-semibold tracking-tight">{summaryLine}</p>
                </div>
                <TierBadge tier={topCandidate?.tier} className="text-base" />
              </div>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-white/70">最注目の候補</p>
                  <p className="font-display text-4xl font-bold leading-none">{topCandidate?.name ?? "-"}</p>
                  <p className="text-sm text-white/70">{topCandidate?.main_reason ?? "AIが上位候補をピックアップしました"}</p>
                </div>
                <div className="relative flex items-center justify-center">
                  <div className="relative h-32 w-32 rounded-full bg-slate-900/60 p-3 shadow-inner">
                    <div
                      className="flex h-full w-full items-center justify-center rounded-full bg-white/5 text-center text-sm font-semibold"
                      style={{
                        backgroundImage: `conic-gradient(#a5f3fc ${topProgress * 360}deg, rgba(255,255,255,0.1) 0deg)`,
                      }}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-xs uppercase tracking-wide text-white/70">Score</span>
                        <span className="font-display text-3xl font-bold">{formatPercent(topCandidate?.total_score)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                <span className="rounded-full bg-white/10 px-3 py-1">{response.tiers.length} tiers</span>
                <span className="rounded-full bg-white/10 px-3 py-1">{sortedScores.length} entries</span>
                {topCandidate?.top_criteria?.[0] && (
                  <span className="rounded-full bg-white/10 px-3 py-1">Key: {topCandidate.top_criteria[0]}</span>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-5 rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900/70 lg:sticky lg:top-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">アクション</p>
              <span className="text-xs uppercase tracking-[0.4em] text-slate-400">Quick</span>
            </div>
            <div className="grid gap-3">
              <button
                type="button"
                onClick={onOpenPublish}
                disabled={publishDisabled}
                className="group relative flex items-center justify-between overflow-hidden rounded-3xl bg-gradient-to-r from-[#ff5f6d] via-[#ff9966] to-[#f6d365] px-5 py-4 text-base font-semibold text-white shadow-[0_25px_45px_rgba(255,95,109,0.35)] transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-60"
              >
                <span className="flex items-center gap-2">
                  <IconCrown className="h-5 w-5 animate-pulse text-white/90" /> 公開設定
                </span>
                <span aria-hidden className="text-lg font-bold">
                  ↗
                </span>
                <span className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-30" style={{ background: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.9), transparent 45%)" }} />
              </button>
              <button
                type="button"
                onClick={onBack}
                className="flex items-center justify-between rounded-3xl border border-slate-200/80 bg-gradient-to-r from-white/90 to-slate-50/80 px-5 py-4 text-base font-semibold text-slate-900 shadow-lg shadow-slate-200/60 transition hover:-translate-y-0.5 dark:border-slate-700/80 dark:from-slate-900/50 dark:to-slate-900/30 dark:text-white"
              >
                <span className="flex items-center gap-2">入力に戻る</span>
                <span aria-hidden>⟲</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-200">
              <div className="rounded-2xl border border-slate-100/80 bg-white/80 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-slate-900/40">
                <p className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">指標</p>
                <p className="font-display text-3xl font-bold text-slate-900 dark:text-white">{metrics.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-100/80 bg-white/80 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-slate-900/40">
                <p className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">履歴保存</p>
                <p className="font-display text-3xl font-bold text-emerald-600 dark:text-emerald-300">AI</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              {[{ label: "JSON", action: onExportJSON }, { label: "CSV", action: onExportCSV }, { label: "PNG", action: onExportPNG }, { label: "PDF", action: onExportPDF }, { label: "Word", action: onExportDocx }].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 font-semibold text-slate-700 shadow-sm transition hover:bg-gradient-to-r hover:from-[#a5f3fc] hover:to-[#fbcfe8] hover:text-slate-900 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                >
                  {item.label} 保存
                </button>
              ))}
            </div>
          </section>
        </div>

        <article
          ref={assignReportRef}
          className="space-y-8 rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-2xl dark:border-white/10 dark:bg-slate-950/60"
        >
          <section className="space-y-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-300">ランキング / Tier一覧</p>
                <h2 className="font-display text-3xl font-bold text-slate-900 dark:text-white">ダッシュボード</h2>
                <p className="text-base text-slate-500 dark:text-slate-300">クリックで詳細を展開して、トヨタなど注目の候補を掘り下げましょう。</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-full bg-slate-100/80 p-1 text-sm dark:bg-slate-800/80">
                  <button
                    type="button"
                    className={clsx(
                      "rounded-full px-4 py-1",
                      viewMode === "ranking"
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900/70 dark:text-white"
                        : "text-slate-500 dark:text-slate-300",
                    )}
                    onClick={() => setViewMode("ranking")}
                  >
                    ランキング
                  </button>
                  <button
                    type="button"
                    className={clsx(
                      "rounded-full px-4 py-1",
                      viewMode === "tier"
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900/70 dark:text-white"
                        : "text-slate-500 dark:text-slate-300",
                    )}
                    onClick={() => setViewMode("tier")}
                  >
                    Tier表
                  </button>
                </div>
              </div>
            </div>

            {viewMode === "ranking" && (
              <RankingTable scores={sortedScores} selectedId={selected?.id} onSelect={(id) => setSelectedId(id)} />
            )}

            {viewMode === "tier" && (
              <TierList tiers={response.tiers} tierOrder={tierOrder} selectedId={selected?.id} onSelect={(id) => setSelectedId(id)} />
            )}
          </section>

          {selected && (
            <section className="space-y-6">
              <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-400">フォーカス</p>
                  <h2 className="font-display text-3xl font-bold text-slate-900 dark:text-white">{selected.name}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-300">
                    Tier {selected.tier} / {formatPercent(selected.total_score)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <TierBadge tier={selected.tier} />
                  <span className="rounded-full bg-gradient-to-r from-emerald-100 via-sky-100 to-blue-100 px-4 py-2 text-sm font-semibold text-emerald-800 dark:from-emerald-900/40 dark:to-blue-900/40 dark:text-emerald-100">
                    {nameMap.get(selected.id) ?? selected.name}
                  </span>
                </div>
              </header>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="space-y-4">
                  {selected.main_reason && (
                    <div className="relative overflow-hidden rounded-[28px] border border-emerald-200/70 bg-gradient-to-r from-emerald-50 via-sky-50 to-white p-6 text-emerald-900 shadow-sm dark:border-emerald-500/40 dark:from-emerald-900/30 dark:via-sky-900/20 dark:to-slate-900/30 dark:text-emerald-100">
                      <div className="flex items-center gap-3 text-base font-semibold">
                        <IconSparkles className="h-6 w-6 text-emerald-500" />
                        主な評価ポイント
                      </div>
                      <p className="mt-2 text-base leading-relaxed">{selected.main_reason}</p>
                    </div>
                  )}

                  <div className="rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
                    <div className="flex items-center gap-2">
                      <IconDocument className="h-5 w-5 text-slate-500" />
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">指標別内訳</h3>
                    </div>
                    <div className="mt-4 space-y-3">
                      {(selected.criteria_breakdown ?? []).map((entry) => {
                        const metric = metricMap.get(entry.key);
                        const ratio = clampProgress(entry.score);
                        return (
                          <div key={entry.key} className="rounded-2xl border border-slate-100/80 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                            <div className="flex items-center justify-between text-sm font-semibold text-slate-600 dark:text-slate-200">
                              <span>{metric?.name ?? entry.key}</span>
                              <span>{formatPercent(entry.score)}</span>
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-slate-200/80 dark:bg-slate-800/80">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-500"
                                style={{ width: `${ratio * 100}%` }}
                              />
                            </div>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{entry.reason}</p>
                          </div>
                        );
                      })}
                      {(selected.criteria_breakdown?.length ?? 0) === 0 && (
                        <p className="text-sm text-slate-500 dark:text-slate-300">内訳情報がありません。</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[28px] border border-amber-200/70 bg-amber-50/90 p-5 shadow-sm dark:border-amber-600/60 dark:bg-amber-900/40">
                    <div className="flex items-center gap-3 text-amber-900 dark:text-amber-100">
                      <IconShield className="h-6 w-6" />
                      <h3 className="text-lg font-semibold">リスク・留意点</h3>
                    </div>
                    {selected.risk_notes?.length ? (
                      <ul className="mt-3 space-y-2 text-sm text-amber-900 dark:text-amber-100">
                        {selected.risk_notes.map((note, index) => (
                          <li key={`${selected.id}-risk-${index}`} className="flex gap-2">
                            <span className="mt-1 h-2 w-2 flex-none rounded-full bg-amber-400" />
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">特筆すべきリスクは報告されていません。</p>
                    )}
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
                    <div className="flex items-center gap-3">
                      <IconLink className="h-5 w-5 text-slate-500" />
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">参考URL</h3>
                    </div>
                    {selected.sources?.length ? (
                      <ul className="mt-3 space-y-3 text-sm">
                        {selected.sources.map((source, index) => {
                          const domain = getReadableDomain(source.url);
                          return (
                            <li key={`${selected.id}-source-${index}`} className="rounded-2xl border border-slate-100/70 bg-slate-50/80 p-4 dark:border-slate-700/70 dark:bg-slate-900/40">
                              <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{source.title ?? source.url}</div>
                              {domain && <div className="text-xs text-slate-500 dark:text-slate-400">{domain}</div>}
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 transition hover:opacity-80 dark:text-emerald-300"
                              >
                                リンクを開く
                                <span aria-hidden>↗</span>
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">参考URLはありません。</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {summary ? (
            <section className="space-y-5 rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-inner dark:border-slate-700 dark:bg-slate-900/70">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-300">
                    <IconDocument className="h-5 w-5" />
                    <p className="text-sm font-medium">{summary.title}</p>
                  </div>
                  <h3 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">{summary.subtitle}</h3>
                </div>
                {hasHiddenSummary && (
                  <button
                    type="button"
                    onClick={() => setSummaryExpanded((prev) => !prev)}
                    className="rounded-full border border-slate-200/70 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                  >
                    {summaryExpanded ? "詳細を隠す" : "詳細を表示"}
                  </button>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {visibleSummarySections.map((section) => (
                  <div
                    key={section.title}
                    className="space-y-2 rounded-[24px] border border-slate-100/80 bg-slate-50/80 p-4 text-sm leading-relaxed text-slate-700 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-200"
                  >
                    <h4 className="text-base font-semibold text-slate-900 dark:text-white">{section.title}</h4>
                    <ul className="space-y-2">
                      {section.paragraphs.map((paragraph, index) => (
                        <li key={`${section.title}-${index}`} className="flex gap-2">
                          <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-slate-300 dark:bg-slate-600" />
                          <span>{paragraph}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <button
              type="button"
              onClick={() => setJsonOpen((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-[28px] border border-slate-200/80 bg-white/80 px-5 py-3 text-left text-base font-semibold transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
            >
              <span>JSON表示</span>
              <span className="text-sm text-slate-500">{jsonOpen ? "閉じる" : "開く"}</span>
            </button>
            {jsonOpen && (
              <pre className="max-h-[480px] overflow-auto rounded-[28px] border border-slate-900 bg-slate-950/90 p-4 text-xs text-slate-100 dark:border-slate-700">
{JSON.stringify(response, null, 2)}
              </pre>
            )}
          </section>
        </article>
      </div>
    </div>
  );
}

type RankingTableProps = {
  scores: ScoreEntry[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

function RankingTable({ scores, selectedId, onSelect }: RankingTableProps) {
  const topEntry = scores[0];
  const otherEntries = scores.slice(1);
  const topProgress = clampProgress(topEntry?.total_score) * 100;

  return (
    <div className="relative overflow-hidden rounded-[40px] border border-white/40 bg-slate-950/40 shadow-[0_40px_80px_rgba(15,23,42,0.55)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            "radial-gradient(circle at 10% 20%, rgba(59,130,246,0.25), transparent 55%), radial-gradient(circle at 90% 30%, rgba(16,185,129,0.25), transparent 60%), radial-gradient(circle at 70% 80%, rgba(248,113,113,0.2), transparent 60%)",
        }}
      />
      <div className="relative space-y-8 rounded-[38px] bg-gradient-to-b from-white/90 to-white/70 p-6 backdrop-blur-xl dark:from-slate-950/70 dark:to-slate-950/50">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-slate-400">Ranking / Tier</p>
            <h3 className="font-display text-4xl font-semibold text-slate-900 dark:text-white">ランキングハイライト</h3>
            <p className="text-base text-slate-500 dark:text-slate-300">一位のトヨタを筆頭に、カードをタップして煌びやかな詳細を開きましょう。</p>
          </div>
          <div className="rounded-full bg-slate-100/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-slate-500 dark:bg-slate-900/50 dark:text-slate-300">Tap for more</div>
        </div>

        {topEntry ? (
          <button
            type="button"
            onClick={() => onSelect?.(topEntry.id)}
            className={clsx(
              "group relative w-full overflow-hidden rounded-[36px] border border-white/30 bg-gradient-to-r from-[#0f172a] via-[#1e1b4b] to-[#4c1d95] p-1 text-left shadow-[0_30px_60px_rgba(79,70,229,0.35)] transition",
              selectedId === topEntry.id ? "ring-2 ring-[#fcd34d]/70" : "hover:translate-y-[-2px]",
            )}
          >
            <div className="absolute inset-0 opacity-80" style={{ background: "radial-gradient(circle at 15% 20%, rgba(252,211,77,0.35), transparent 55%)" }} />
            <div className="relative rounded-[34px] bg-gradient-to-r from-[#1e1b4b]/95 via-[#312e81]/90 to-[#0f172a]/90 p-6 text-white">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.5em] text-amber-200">
                    Rank 01
                    <IconCrown className="h-4 w-4 animate-pulse text-amber-200" />
                  </div>
                  <p className="font-display text-4xl font-bold">{topEntry.name}</p>
                  <p className="text-base text-white/80">{topEntry.main_reason ?? "AIが選んだトップ企業のサマリーをチェック"}</p>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {(topEntry.top_criteria ?? []).slice(0, 3).map((criteria) => (
                      <span key={criteria} className="rounded-full bg-white/10 px-3 py-1 text-white/80">
                        {criteria}
                      </span>
                    ))}
                    <span className="rounded-full bg-white/5 px-3 py-1 text-white/60">ID: {topEntry.id}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-4">
                  <div className="text-right">
                    <div className="flex items-center gap-3 text-5xl font-black text-amber-200">
                      {formatPercent(topEntry.total_score)}
                      <span aria-hidden className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-white/10 text-amber-200 shadow-[0_0_25px_rgba(252,211,77,0.5)]">
                        <IconCrown className="h-6 w-6" />
                      </span>
                    </div>
                    <p className="text-xs uppercase tracking-[0.4em] text-white/60">総合スコア</p>
                  </div>
                  <div className="relative h-24 w-24">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#fde68a]/30 via-[#fbcfe8]/30 to-[#a5f3fc]/30 blur-3xl" aria-hidden />
                    <div className="relative flex h-full w-full flex-col items-center justify-center rounded-full border border-white/40 bg-white/10 text-center">
                      <span className="text-xs uppercase tracking-[0.4em] text-white/70">Tier</span>
                      <span className="font-display text-4xl font-bold text-white">{topEntry.tier}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <div className="relative h-4 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#fde047] via-[#f97316] to-[#ec4899] shadow-[0_0_25px_rgba(249,115,22,0.65)] transition-all duration-700"
                    style={{ width: `${topProgress}%` }}
                  />
                  <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(120deg, rgba(255,255,255,0.9) 0%, transparent 40%, rgba(255,255,255,0.9) 100%)" }} />
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-white/80">
                  <div className="flex items-center gap-2">
                    <IconRadar className="h-5 w-5" />
                    <span>トレンド指数: {formatPercent(topEntry.total_score)}</span>
                  </div>
                  {topEntry.top_criteria?.[0] && (
                    <div className="flex items-center gap-2">
                      <IconSparkles className="h-5 w-5" />
                      <span>注目指標: {topEntry.top_criteria[0]}</span>
                    </div>
                  )}
                </div>
                {selectedId === topEntry.id && topEntry.main_reason && (
                  <div className="rounded-3xl border border-white/20 bg-white/5 p-4 text-sm text-white/90">
                    <p className="font-semibold tracking-wide text-amber-200">フォーカス詳細</p>
                    <p className="mt-1 leading-relaxed">{topEntry.main_reason}</p>
                  </div>
                )}
              </div>
            </div>
          </button>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-transparent dark:text-slate-300">ランキングデータがまだありません。</div>
        )}

        {otherEntries.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-400">ほかの順位</p>
            <div className="grid gap-4 lg:grid-cols-2">
              {otherEntries.map((entry, index) => {
                const displayRank = index + 2;
                const isSelected = entry.id === selectedId;
                const ratio = clampProgress(entry.total_score) * 100;
                const firstCriteria = entry.top_criteria?.[0];
                const detailNote = entry.main_reason ?? entry.risk_notes?.[0];
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onSelect?.(entry.id)}
                    className={clsx(
                      "group relative overflow-hidden rounded-3xl border border-slate-200/60 bg-gradient-to-b from-white/95 to-white/70 p-5 text-left shadow-lg transition dark:border-slate-800/60 dark:from-slate-900/50 dark:to-slate-950/40",
                      isSelected ? "ring-2 ring-emerald-300" : "hover:-translate-y-1",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.6em] text-slate-400">Rank {String(displayRank).padStart(2, "0")}</p>
                        <p className="font-display text-2xl font-bold text-slate-900 dark:text-white">{entry.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-300">{firstCriteria ? `主要指標: ${firstCriteria}` : "指標詳細を開いて確認"}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-black text-emerald-600 dark:text-emerald-300">{formatPercent(entry.total_score)}</div>
                        <TierBadge tier={entry.tier} className="mt-2 px-5 py-1.5 text-base" />
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="relative h-3 overflow-hidden rounded-full bg-slate-200/80 shadow-inner dark:bg-slate-800/80">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-300 via-sky-400 to-indigo-500 shadow-[0_0_12px_rgba(14,165,233,0.55)] transition-all duration-500"
                          style={{ width: `${ratio}%` }}
                        />
                        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(120deg, rgba(255,255,255,0.8) 0%, transparent 40%, rgba(255,255,255,0.6) 100%)" }} />
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300">
                        {(entry.top_criteria ?? []).slice(0, 3).map((criteria) => (
                          <span key={`${entry.id}-${criteria}`} className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 dark:bg-slate-800/70 dark:text-slate-200">
                            {criteria}
                          </span>
                        ))}
                        {(entry.top_criteria?.length ?? 0) === 0 && <span className="rounded-full border border-dashed border-slate-200 px-3 py-1">情報準備中</span>}
                      </div>
                    </div>
                    {isSelected && detailNote && (
                      <div className="mt-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-4 text-sm text-emerald-900 shadow-inner dark:border-emerald-500/50 dark:bg-emerald-900/30 dark:text-emerald-100">
                        <div className="flex items-center gap-2">
                          <IconSparkles className="h-4 w-4" />
                          <p className="font-semibold">フォーカス</p>
                        </div>
                        <p className="mt-1 leading-relaxed">{detailNote}</p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type TierListProps = {
  tiers: TierEntry[];
  tierOrder: string[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

function TierList({ tiers, tierOrder, selectedId, onSelect }: TierListProps) {
  const palette: Record<string, { border: string; gradient: string; accent: string }> = {
    S: { border: "border-[#fb7185]/60", gradient: "from-[#f97316]/25 via-[#fb7185]/20 to-[#f472b6]/20", accent: "text-[#fb7185]" },
    A: { border: "border-[#34d399]/60", gradient: "from-[#34d399]/25 via-[#22d3ee]/20 to-[#818cf8]/20", accent: "text-[#10b981]" },
    B: { border: "border-[#fbbf24]/60", gradient: "from-[#fbbf24]/25 via-[#f59e0b]/20 to-[#f97316]/20", accent: "text-[#f97316]" },
    C: { border: "border-[#a855f7]/60", gradient: "from-[#a855f7]/20 via-[#ec4899]/20 to-[#ef4444]/20", accent: "text-[#a855f7]" },
    default: { border: "border-slate-200", gradient: "from-slate-50 via-slate-100 to-white", accent: "text-slate-900" },
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-3xl font-semibold text-slate-900 dark:text-white">Tierシグナル</h3>
        <p className="text-base text-slate-500 dark:text-slate-300">Tierごとの大きなブロックで、所属企業数やハイライトを一目で把握できます。</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {tierOrder.map((tierLabel) => {
          const tierData = tiers.find((entry) => entry.label === tierLabel);
          const count = tierData?.items?.length ?? 0;
          const topItem = tierData?.items?.[0];
          const colors = palette[tierLabel] ?? palette.default;
          return (
            <div
              key={tierLabel}
              className={clsx(
                "relative overflow-hidden rounded-[32px] border bg-white/95 p-6 shadow-[0_25px_55px_rgba(15,23,42,0.15)] transition dark:bg-slate-950/60",
                colors.border,
              )}
            >
              <div className={clsx("pointer-events-none absolute inset-0 opacity-70", `bg-gradient-to-r ${colors.gradient}`)} aria-hidden />
              <div className="relative space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Tier</p>
                    <p className={clsx("font-display text-4xl font-bold", colors.accent)}> {tierLabel}</p>
                  </div>
                  <TierBadge tier={tierLabel} className="min-w-[4rem] px-6 py-2 text-lg" />
                </div>
                <div className="grid gap-3 text-sm text-slate-600 dark:text-slate-200 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-center shadow-sm dark:border-white/10 dark:bg-slate-900/60">
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Companies</p>
                    <p className="font-display text-3xl font-bold text-slate-900 dark:text-white">{count}</p>
                  </div>
                  <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-center shadow-sm dark:border-white/10 dark:bg-slate-900/60">
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Top</p>
                    <p className="font-display text-xl font-semibold text-slate-900 dark:text-white">{topItem?.name ?? "-"}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {(tierData?.items ?? []).map((item) => {
                    const isSelected = item.id === selectedId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelect?.(item.id)}
                        className={clsx(
                          "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-base font-medium transition",
                          isSelected
                            ? "border-emerald-400 bg-white/90 text-emerald-900 shadow-lg ring-2 ring-emerald-300/60 dark:border-emerald-500 dark:bg-slate-900/60 dark:text-emerald-100"
                            : "border-white/60 bg-white/70 text-slate-900 hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-50",
                        )}
                      >
                        <div>
                          <p className="text-lg font-semibold">{item.name}</p>
                          {item.top_criteria?.[0] && <p className="text-xs text-slate-400">{item.top_criteria[0]}</p>}
                        </div>
                        <div className="text-right">
                          <p className="font-display text-2xl font-bold text-emerald-600 dark:text-emerald-300">{formatPercent(item.score)}</p>
                          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Score</p>
                        </div>
                      </button>
                    );
                  })}
                  {(tierData?.items?.length ?? 0) === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/70 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      該当なし
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ResultReport;
