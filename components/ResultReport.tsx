"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MutableRefObject,
  type RefObject,
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

function TierBadge({ tier, className }: { tier?: string; className?: string }) {
  const map: Record<string, string> = {
    S: "from-purple-600 to-purple-500",
    A: "from-emerald-600 to-emerald-500",
    B: "from-amber-500 to-amber-400",
    C: "from-rose-600 to-rose-500",
  };

  return (
    <span
      className={clsx(
        "inline-flex min-w-[2.5rem] items-center justify-center rounded-full bg-gradient-to-r px-3 py-1 text-sm font-semibold text-white",
        map[tier ?? ""] ?? "from-slate-500 to-slate-400",
        className,
      )}
    >
      {tier ?? "-"}
    </span>
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

  return (
    <div ref={assignViewRef} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-300">評価レポート</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">最新の評価結果</h1>
          <p className="text-base text-slate-600 dark:text-slate-200">{summaryLine}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onBack}
            className="w-full rounded-2xl border border-slate-300 px-5 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            入力に戻る
          </button>
          <button
            type="button"
            onClick={onOpenPublish}
            disabled={publishDisabled}
            className="w-full rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-base font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
          >
            公開設定
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onExportJSON}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          JSON保存
        </button>
        <button
          type="button"
          onClick={onExportCSV}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          CSV保存
        </button>
        <button
          type="button"
          onClick={onExportPNG}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          PNG保存
        </button>
        <button
          type="button"
          onClick={onExportPDF}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          PDF出力
        </button>
        <button
          type="button"
          onClick={onExportDocx}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Word出力
        </button>
      </div>

      <article
        ref={assignReportRef}
        className="space-y-6 rounded-3xl border border-slate-200 bg-slate-50/70 p-6 dark:border-slate-700 dark:bg-slate-900/60"
      >
        <section className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">ランキング / Tier一覧</h2>
              <p className="text-sm text-slate-500 dark:text-slate-300">{sortedScores.length} 件・{response.tiers.length} ティア</p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-300">{summaryLine}</p>
                <div className="inline-flex rounded-full bg-slate-100 p-1 text-sm dark:bg-slate-800">
                  <button
                    type="button"
                    className={clsx(
                      "rounded-full px-3 py-1",
                      viewMode === "ranking"
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900/70 dark:text-slate-50"
                        : "text-slate-500 dark:text-slate-300",
                    )}
                    onClick={() => setViewMode("ranking")}
                  >
                    ランキング
                  </button>
                  <button
                    type="button"
                    className={clsx(
                      "rounded-full px-3 py-1",
                      viewMode === "tier"
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900/70 dark:text-slate-50"
                        : "text-slate-500 dark:text-slate-300",
                    )}
                    onClick={() => setViewMode("tier")}
                  >
                    Tier表
                  </button>
                </div>
              </div>
            </div>
          </div>

          {viewMode === "ranking" && (
            <RankingTable
              scores={sortedScores}
              selectedId={selected?.id}
              onSelect={(id) => setSelectedId(id)}
            />
          )}

          {viewMode === "tier" && (
            <TierList
              tiers={response.tiers}
              tierOrder={tierOrder}
              selectedId={selected?.id}
              onSelect={(id) => setSelectedId(id)}
            />
          )}
        </section>

        {selected && (
          <section className="space-y-4">
            <header className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{selected.name}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  Tier {selected.tier} / {formatPercent(selected.total_score)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <TierBadge tier={selected.tier} />
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                  {nameMap.get(selected.id) ?? selected.name}
                </span>
              </div>
            </header>

            {selected.main_reason && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900 shadow-sm dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100">
                <h3 className="text-base font-semibold">主な評価ポイント</h3>
                <p className="mt-1 leading-relaxed">{selected.main_reason}</p>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">指標別内訳</h3>
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-700">
                  <thead className="bg-slate-100 dark:bg-slate-800/70">
                    <tr>
                      <th className="px-3 py-2 font-semibold">指標</th>
                      <th className="px-3 py-2 font-semibold">重み</th>
                      <th className="px-3 py-2 font-semibold">スコア</th>
                      <th className="px-3 py-2 font-semibold">理由</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-sm dark:divide-slate-800 dark:bg-slate-900/40">
                    {(selected.criteria_breakdown ?? []).map((entry) => {
                      const metric = metricMap.get(entry.key);
                      return (
                        <tr key={entry.key}>
                          <td className="px-3 py-2 font-medium">{metric?.name ?? entry.key}</td>
                          <td className="px-3 py-2">{entry.weight}</td>
                          <td className="px-3 py-2 font-semibold">{formatPercent(entry.score)}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{entry.reason}</td>
                        </tr>
                      );
                    })}
                    {(selected.criteria_breakdown?.length ?? 0) === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                          内訳情報がありません。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm dark:border-amber-600 dark:bg-amber-900/40">
                  <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">リスク・懸念点</h3>
                  {selected.risk_notes?.length ? (
                    <ul className="mt-2 space-y-2 text-sm text-amber-900 dark:text-amber-100">
                      {selected.risk_notes.map((note, index) => (
                        <li key={`${selected.id}-risk-${index}`} className="flex gap-2">
                          <span className="mt-1 h-2 w-2 flex-none rounded-full bg-amber-500" />
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-amber-700 dark:text-amber-200">特筆すべきリスクは報告されていません。</p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">参考URL</h3>
                  {selected.sources?.length ? (
                    <ul className="mt-2 space-y-3 text-sm">
                      {selected.sources.map((source, index) => {
                        const domain = getReadableDomain(source.url);
                        return (
                          <li key={`${selected.id}-source-${index}`} className="rounded-xl bg-slate-100/60 p-3 dark:bg-slate-800/70">
                            <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{source.title ?? source.url}</div>
                            {domain && <div className="text-xs text-slate-500 dark:text-slate-400">{domain}</div>}
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                            >
                              リンクを開く
                              <span aria-hidden>↗</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">参考URLはありません。</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {summary ? (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{summary.title}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-300">{summary.subtitle}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3 md:gap-4">
              {summary.sections.map((section) => (
                <div
                  key={section.title}
                  className="space-y-2 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 text-sm leading-relaxed text-slate-700 dark:border-slate-700/70 dark:bg-slate-900/40 dark:text-slate-200"
                >
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{section.title}</h3>
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
            className="flex w-full items-center justify-between rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-base font-semibold transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100"
          >
            <span>JSON表示</span>
            <span className="text-sm text-slate-500">{jsonOpen ? "閉じる" : "開く"}</span>
          </button>
          {jsonOpen && (
            <pre className="max-h-[480px] overflow-auto rounded-2xl border border-slate-200 bg-slate-900 p-4 text-xs text-slate-100 dark:border-slate-700">
{JSON.stringify(response, null, 2)}
            </pre>
          )}
        </section>
      </article>
    </div>
  );
}

type RankingTableProps = {
  scores: ScoreEntry[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

function RankingTable({ scores, selectedId, onSelect }: RankingTableProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-950/40">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700 dark:bg-slate-900/50">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">ランキング</h3>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-base dark:divide-slate-800">
          <thead className="bg-slate-100/80 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800/80 dark:text-slate-200">
            <tr>
              <th className="px-5 py-3">順位</th>
              <th className="px-5 py-3">候補</th>
              <th className="px-5 py-3">Tier</th>
              <th className="px-5 py-3 text-right">スコア</th>
              <th className="px-5 py-3">主要指標</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-base dark:divide-slate-900/60 dark:bg-slate-950/40">
            {scores.map((entry, index) => {
              const topCriteria = entry.top_criteria?.length ? entry.top_criteria.join(" / ") : "-";
              const isSelected = entry.id === selectedId;
              const isTop = index === 0;
              return (
                <tr
                  key={entry.id}
                  onClick={() => onSelect?.(entry.id)}
                  className={clsx(
                    "cursor-pointer transition",
                    isSelected ? "bg-emerald-50/80 dark:bg-emerald-900/40" : undefined,
                    !isSelected && isTop ? "bg-emerald-50/60 dark:bg-emerald-900/30" : undefined,
                    "hover:bg-emerald-50/70 dark:hover:bg-emerald-900/30",
                  )}
                >
                  <td className="px-5 py-4 text-lg font-semibold">
                    <span className="inline-flex items-center gap-2">
                      {index + 1}
                      {isTop && <span aria-hidden className="text-base">🏆</span>}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-lg font-semibold text-slate-900 dark:text-slate-50">{entry.name}</span>
                      <span className="text-xs text-slate-400">ID: {entry.id}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <TierBadge tier={entry.tier} className="px-4 py-1.5 text-sm" />
                  </td>
                  <td className="px-5 py-4 text-right text-xl font-semibold text-emerald-700 dark:text-emerald-300">
                    {formatPercent(entry.total_score)}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{topCriteria}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tier一覧</h3>
        <p className="text-sm text-slate-500 dark:text-slate-300">Tierごとの候補をカード形式で確認できます。</p>
      </div>
      <div className="space-y-4">
        {tierOrder.map((tierLabel, index) => {
          const tierData = tiers.find((entry) => entry.label === tierLabel);
          const isTopTier = index === 0;
          return (
            <div
              key={tierLabel}
              className={clsx(
                "flex flex-col gap-4 rounded-3xl border bg-white/95 p-5 shadow-sm transition dark:bg-slate-950/40",
                isTopTier
                  ? "border-l-4 border-emerald-400 bg-emerald-50/80 dark:border-emerald-500 dark:bg-emerald-900/30"
                  : "border-slate-200 dark:border-slate-700",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="text-xl font-bold text-slate-900 dark:text-slate-50">Tier {tierLabel}</div>
                <TierBadge tier={tierLabel} className="min-w-[3rem] px-5 py-1.5 text-base" />
              </div>
              <div className="space-y-3 text-base text-slate-700 dark:text-slate-200">
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
                          ? "border-emerald-400 bg-emerald-50/80 text-emerald-900 shadow-sm dark:border-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-100"
                          : "border-transparent bg-slate-100/80 text-slate-900 hover:border-slate-200 dark:bg-slate-900/50 dark:text-slate-50",
                      )}
                    >
                      <span className="text-lg font-semibold">{item.name}</span>
                      <span className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                        {formatPercent(item.score)}
                      </span>
                    </button>
                  );
                })}
                {(tierData?.items?.length ?? 0) === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-400 dark:border-slate-600 dark:text-slate-500">
                    該当なし
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ResultReport;
