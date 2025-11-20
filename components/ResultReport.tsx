"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MutableRefObject,
  type ReactNode,
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

function IconTrophy(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M8 6V3h8v3" />
      <path d="M9 13c1.4.8 4.6.8 6 0" />
      <path d="M12 13v4" />
      <path d="M7 21h10" />
      <path d="M4 6h4c0 1.6-.4 5-4 6-1-2.5-1-4.5 0-6Z" />
      <path d="M20 6h-4c0 1.6.4 5 4 6 1-2.5 1-4.5 0-6Z" />
    </svg>
  );
}

function IconTarget(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <circle cx={12} cy={12} r={9} />
      <circle cx={12} cy={12} r={5} />
      <path d="M12 3v3" />
      <path d="M21 12h-3" />
      <path d="M12 21v-3" />
      <path d="M3 12h3" />
      <circle cx={12} cy={12} r={1.5} fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconColumns(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <rect x={3} y={4} width={6.5} height={16} rx={1.5} />
      <rect x={14.5} y={4} width={6.5} height={16} rx={1.5} />
      <path d="M6.25 8h0.5" />
      <path d="M17.25 8h0.5" />
    </svg>
  );
}

function IconUsers(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <circle cx={9} cy={7} r={3} />
      <circle cx={18} cy={9} r={2.5} />
      <path d="M3 20.5c0-3.2 3-5.5 6-5.5s6 2.3 6 5.5" />
      <path d="M14.5 20.5c0-2.2 2.1-3.8 4.5-3.8 0.9 0 1.7 0.2 2.5 0.6" />
    </svg>
  );
}

function IconGauge(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M5 19a9 9 0 1 1 14 0Z" />
      <path d="M12 12.5 16 9" />
      <circle cx={12} cy={13} r={1.2} fill="currentColor" stroke="none" />
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
  actionSlot?: ReactNode;
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
  actionSlot,
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
      className="relative overflow-hidden rounded-[40px] border border-slate-200 bg-white p-[1px] shadow-[0_30px_80px_rgba(15,23,42,0.12)]"
    >
      <div className="relative space-y-8 rounded-[38px] bg-white p-6 text-slate-900">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,0.9fr)]">
          <section className="relative overflow-hidden rounded-[32px] border border-amber-100 bg-gradient-to-r from-amber-50 via-white to-emerald-50 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.12)]">
            <div className="relative flex flex-col gap-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-700">最新サマリー</p>
                  <p className="font-display text-3xl font-semibold tracking-tight text-slate-900">{summaryLine}</p>
                </div>
                <TierBadge tier={topCandidate?.tier} className="text-base" />
              </div>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-slate-500">最注目の候補</p>
                  <p className="font-display text-4xl font-bold leading-none text-slate-900">{topCandidate?.name ?? "-"}</p>
                  <p className="text-sm text-slate-600">{topCandidate?.main_reason ?? "AIが上位候補をピックアップしました"}</p>
                </div>
                <div className="relative flex items-center justify-center">
                  <div className="relative h-32 w-32 rounded-full bg-white p-3 shadow-inner">
                    <div
                      className="flex h-full w-full items-center justify-center rounded-full bg-slate-50 text-center text-sm font-semibold"
                      style={{
                        backgroundImage: `conic-gradient(#10b981 ${topProgress * 360}deg, rgba(226,232,240,0.8) 0deg)`,
                      }}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-xs uppercase tracking-wide text-slate-500">Score</span>
                        <span className="font-display text-3xl font-bold text-slate-900">{formatPercent(topCandidate?.total_score)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                <span className="rounded-full bg-white px-3 py-1 shadow-sm">{response.tiers.length} tiers</span>
                <span className="rounded-full bg-white px-3 py-1 shadow-sm">{sortedScores.length} entries</span>
                {topCandidate?.top_criteria?.[0] && (
                  <span className="rounded-full bg-white px-3 py-1 shadow-sm">Key: {topCandidate.top_criteria[0]}</span>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-5 rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900/70 lg:sticky lg:top-6">
            {actionSlot ?? (
              <>
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
              </>
            )}
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
              <TierList tiers={response.tiers} selectedId={selected?.id} onSelect={(id) => setSelectedId(id)} />
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
  const podiumEntries = scores.slice(0, 3);
  const otherEntries = scores.slice(3);
  const podiumStyles = [
    {
      label: "1位",
      border: "border-amber-200",
      badge: "bg-amber-500 text-white",
      surface: "from-amber-50 to-yellow-50",
    },
    {
      label: "2位",
      border: "border-slate-200",
      badge: "bg-slate-500 text-white",
      surface: "from-slate-50 to-gray-50",
    },
    {
      label: "3位",
      border: "border-orange-200",
      badge: "bg-orange-500 text-white",
      surface: "from-orange-50 to-amber-50",
    },
  ];

  return (
    <div className="space-y-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_30px_70px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Ranking / Tier</p>
          <h3 className="font-display text-3xl font-semibold text-slate-900">縦型ランキング</h3>
          <p className="text-base text-slate-600">順位ごとに大きさと装飾を変えた王道の縦積みレイアウトです。</p>
        </div>
        <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">
          Tap to focus
        </span>
      </div>

      <div className="space-y-4">
        {podiumEntries.map((entry, index) => {
          const style = podiumStyles[index] ?? podiumStyles[2];
          const ratio = clampProgress(entry.total_score) * 100;
          const detailNote = entry.main_reason ?? entry.risk_notes?.[0];
          const isSelected = selectedId === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelect?.(entry.id)}
              className={clsx(
                "w-full rounded-3xl border bg-gradient-to-r p-5 text-left transition shadow-[0_20px_60px_rgba(15,23,42,0.08)]",
                style.surface,
                style.border,
                isSelected ? "ring-2 ring-emerald-300" : "hover:-translate-y-0.5",
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className={clsx("rounded-full px-3 py-1 text-sm font-semibold", style.badge)}>{style.label}</span>
                    <TierBadge tier={entry.tier} />
                  </div>
                  <p className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">{entry.name}</p>
                  <p className="text-sm text-slate-600">{detailNote ?? "AIのコメントを確認してください"}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                    {(entry.top_criteria ?? []).slice(0, 2).map((criteria) => (
                      <span key={`${entry.id}-${criteria}`} className="rounded-full bg-slate-100 px-3 py-1">
                        {criteria}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3 text-right">
                  <div className="text-3xl font-black text-slate-900">{formatPercent(entry.total_score)}</div>
                  <p className="text-[0.7rem] uppercase tracking-[0.4em] text-slate-500">スコア</p>
                  <div className="h-2 w-28 rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${ratio}%` }} />
                  </div>
                  <p className="text-xs text-slate-500">ID: {entry.id}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {otherEntries.length > 0 && (
        <div className="space-y-2 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>4位以降</span>
            <span>エントリー {otherEntries.length} 件</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {otherEntries.map((entry, index) => {
              const isSelected = entry.id === selectedId;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelect?.(entry.id)}
                  className={clsx(
                    "flex flex-col items-start gap-2 rounded-2xl border bg-white px-4 py-3 text-left text-sm transition hover:-translate-y-0.5 hover:shadow-md",
                    isSelected ? "ring-2 ring-emerald-200" : "border-slate-200",
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                        #{index + 4}
                      </span>
                      <div>
                        <p className="text-base font-semibold text-slate-900">{entry.name}</p>
                        <p className="text-xs text-slate-500">
                          Tier {entry.tier} / {formatPercent(entry.total_score)}
                        </p>
                      </div>
                    </div>
                    <TierBadge tier={entry.tier} />
                  </div>
                  <p className="text-xs text-slate-600">{entry.main_reason ?? entry.risk_notes?.[0] ?? "AIのコメントを確認してください"}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
type TierListProps = {
  tiers: TierEntry[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

function TierList({ tiers, selectedId, onSelect }: TierListProps) {
  const palette: Record<
    string,
    {
      labelBg: string;
      chipBg: string;
      chipText: string;
      chipActiveBg: string;
      chipActiveText: string;
      count: string;
    }
  > = {
    S: {
      labelBg: "#FF7F7F",
      chipBg: "#FFF2F2",
      chipText: "#991b1b",
      chipActiveBg: "#FFE4E4",
      chipActiveText: "#7f1d1d",
      count: "border-[#ffc7c7] bg-[#fff2f2] text-[#7f1d1d]",
    },
    A: {
      labelBg: "#FFBF7F",
      chipBg: "#FFF4EB",
      chipText: "#9a3412",
      chipActiveBg: "#FFE8D5",
      chipActiveText: "#7c2d12",
      count: "border-[#ffdcb3] bg-[#fff4eb] text-[#7c2d12]",
    },
    B: {
      labelBg: "#FFDF7F",
      chipBg: "#FFFAEB",
      chipText: "#854d0e",
      chipActiveBg: "#FFF4CF",
      chipActiveText: "#713f12",
      count: "border-[#ffe7aa] bg-[#fffaeb] text-[#713f12]",
    },
    C: {
      labelBg: "#FFFF7F",
      chipBg: "#FEFCE8",
      chipText: "#854d0e",
      chipActiveBg: "#FEF9C3",
      chipActiveText: "#713f12",
      count: "border-[#fff7a8] bg-[#fefce8] text-[#713f12]",
    },
    D: {
      labelBg: "#BFFFFF",
      chipBg: "#F0FDFF",
      chipText: "#0e7490",
      chipActiveBg: "#D5F7FF",
      chipActiveText: "#0f172a",
      count: "border-[#b9f2ff] bg-[#f0fdff] text-[#0e7490]",
    },
    default: {
      labelBg: "#CBD5E1",
      chipBg: "#F8FAFC",
      chipText: "#0f172a",
      chipActiveBg: "#E2E8F0",
      chipActiveText: "#0f172a",
      count: "border-slate-200 bg-slate-50 text-slate-700",
    },
  };
  
  const fixedTierOrder = ["S", "A", "B", "C", "D"];
  const labels = fixedTierOrder;
  const totalCompanies = tiers.reduce((sum, tier) => sum + (tier.items?.length ?? 0), 0);
  
  return (
    <div className="space-y-4 rounded-[32px] border border-slate-200 bg-slate-50 p-6 shadow-[0_30px_70px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Tier表</p>
          <h3 className="font-display text-3xl font-semibold text-slate-900">行形式のTier表</h3>
          <p className="text-base text-slate-600">S から D まで固定の行にラベルと企業カードを並べる TierMaker 形式です。</p>
        </div>
        <span className="text-xs text-slate-400">タップで詳細を確認</span>
      </div>
      <div className="space-y-3">
        {labels.map((tierLabel) => {
          const tierData = tiers.find((entry) => entry.label === tierLabel);
          const itemsInTier = tierData?.items ?? [];
          const count = itemsInTier.length;
          const topItem = itemsInTier[0];
          const avgScore = count
            ? itemsInTier.reduce((acc, item) => acc + (item.score ?? 0), 0) / count
            : 0;
          const colors = palette[tierLabel] ?? palette.default;
          const ratio = totalCompanies > 0 ? Math.round((count / totalCompanies) * 100) : 0;
          return (
            <div
              key={tierLabel}
              className="grid grid-cols-[80px_1fr] items-stretch overflow-hidden rounded-3xl border border-slate-200 bg-white"
            >
              <div
                className="flex flex-col items-center justify-center gap-1 text-white"
                style={{ backgroundColor: colors.labelBg }}
              >
                <span className="text-lg font-bold">{tierLabel}</span>
                <span className="text-[11px] uppercase tracking-[0.3em] text-white/90">Tier</span>
              </div>
              <div className="space-y-3 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <TierBadge tier={tierLabel} />
                    <div>
                      <p className="text-lg font-semibold text-slate-900">ランク {tierLabel}</p>
                      <p className="text-sm text-slate-500">{count} 件 / 占有 {ratio}%</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${colors.count}`}>
                    トップ {topItem?.name ?? "未登録"}
                  </span>
                </div>
                <div className="flex min-h-[88px] flex-wrap content-start gap-2">
                  {itemsInTier.length === 0 && (
                    <span className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                      このTierの企業はまだありません。
                    </span>
                  )}
                  {itemsInTier.map((item) => {
                    const isSelected = item.id === selectedId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelect?.(item.id)}
                        className="flex items-center gap-3 rounded-2xl border px-3 py-2 text-left text-sm shadow-sm transition"
                        style={
                          isSelected
                            ? { backgroundColor: colors.chipActiveBg, color: colors.chipActiveText, borderColor: colors.labelBg }
                            : { backgroundColor: colors.chipBg, color: colors.chipText, borderColor: colors.labelBg }
                        }
                      >
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold">
                          {item.name?.[0] ?? "?"}
                        </span>
                        <div>
                          <p className="text-sm font-semibold">{item.name}</p>
                          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-500">{formatPercent(item.score)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">平均スコア {formatPercent(avgScore)}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">トップ指標 {topItem?.top_criteria?.[0] ?? "-"}</span>
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
