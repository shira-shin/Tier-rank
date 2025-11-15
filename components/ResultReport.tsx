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

function TierBadge({ tier }: { tier?: string }) {
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
      )}
    >
      {tier ?? "-"}
    </span>
  );
}

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
  const sortedScores = useMemo(() => [...response.scores].sort((a, b) => b.total_score - a.total_score), [response.scores]);
  const [selectedId, setSelectedId] = useState(sortedScores[0]?.id ?? "");

  useEffect(() => {
    const top = sortedScores[0];
    if (!top) {
      setSelectedId("");
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
        {summary ? (
          <section className="space-y-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{summary.title}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">{summary.subtitle}</p>
            </div>
            {summary.sections.map((section) => (
              <div key={section.title} className="space-y-2 rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{section.title}</h3>
                <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                  {section.paragraphs.map((paragraph, index) => (
                    <li key={`${section.title}-${index}`} className="flex gap-2">
                      <span className="text-slate-400">•</span>
                      <span>{paragraph}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ) : null}

        <section className="space-y-4">
          <header className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Tier表</h2>
            <span className="text-sm text-slate-500 dark:text-slate-300">{response.tiers.length} ティア</span>
          </header>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {tierOrder.map((tier) => {
              const tierData = response.tiers.find((entry) => entry.label === tier);
              return (
                <div
                  key={tier}
                  className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/60"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tier {tier}</div>
                    <TierBadge tier={tier} />
                  </div>
                  <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                    {(tierData?.items ?? []).map((item) => (
                      <li key={item.id} className="flex flex-col rounded-xl bg-slate-100/60 p-3 dark:bg-slate-900/60">
                        <span className="font-semibold">{item.name}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-300">{formatPercent(item.score)}</span>
                      </li>
                    ))}
                    {(tierData?.items?.length ?? 0) === 0 && (
                      <li className="rounded-xl border border-dashed border-slate-300 p-3 text-xs text-slate-400 dark:border-slate-600 dark:text-slate-500">
                        該当なし
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <header className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">ランキング</h2>
            <span className="text-sm text-slate-500 dark:text-slate-300">{sortedScores.length} 件</span>
          </header>
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-full divide-y divide-slate-200 text-left text-base dark:divide-slate-700">
              <thead className="bg-slate-100 dark:bg-slate-800/70">
                <tr>
                  <th className="px-4 py-3 font-semibold">順位</th>
                  <th className="px-4 py-3 font-semibold">候補</th>
                  <th className="px-4 py-3 font-semibold">Tier</th>
                  <th className="px-4 py-3 font-semibold">スコア</th>
                  <th className="px-4 py-3 font-semibold">主要指標</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm dark:divide-slate-800 dark:bg-slate-900/40">
                {sortedScores.map((entry, index) => {
                  const topCriteria = entry.top_criteria?.length ? entry.top_criteria.join(" / ") : "-";
                  const isSelected = entry.id === selected?.id;
                  return (
                    <tr
                      key={entry.id}
                      onClick={() => setSelectedId(entry.id)}
                      className={clsx(
                        "cursor-pointer transition hover:bg-emerald-50/70 dark:hover:bg-emerald-900/30",
                        isSelected ? "bg-emerald-50/80 dark:bg-emerald-900/40" : undefined,
                      )}
                    >
                      <td className="px-4 py-3 font-semibold">{index + 1}</td>
                      <td className="px-4 py-3 text-base font-medium">
                        <div className="flex flex-col">
                          <span>{entry.name}</span>
                          <span className="text-xs text-slate-400">ID: {entry.id}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <TierBadge tier={entry.tier} />
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatPercent(entry.total_score)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{topCriteria}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

export default ResultReport;
