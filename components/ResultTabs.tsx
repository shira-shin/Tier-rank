"use client";

import { Fragment, useMemo, useRef, useState, type RefObject } from "react";
import clsx from "clsx";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { AgentItem, AgentResult, ItemInput, MetricInput, ScoreResponse } from "@/lib/types";
import type { ReportSummary } from "@/lib/report";

// Type guard to differentiate score response entries from agent items
function isScoreResponseEntry(
  entry: ScoreResponse["scores"][number] | AgentItem,
): entry is ScoreResponse["scores"][number] {
  return (
    entry !== null &&
    typeof entry === "object" &&
    "total_score" in entry &&
    "criteria_breakdown" in entry
  );
}

function TierBadge({ tier }: { tier?: string }) {
  const map: Record<string, string> = {
    S: "from-purple-500 to-fuchsia-500",
    A: "from-emerald-500 to-cyan-500",
    B: "from-sky-500 to-indigo-500",
    C: "from-amber-500 to-orange-500",
  };
  return (
    <span
      className={clsx(
        "inline-flex min-w-[2.75rem] items-center justify-center rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold uppercase tracking-wide text-white shadow",
        tier ? `bg-gradient-to-r ${map[tier] ?? "from-slate-500 to-slate-600"}` : undefined,
      )}
    >
      {tier ?? "-"}
    </span>
  );
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

export type ViewTab = "tier" | "rank" | "cards" | "radar" | "report" | "json";

type ResultTabsProps = {
  data?: AgentResult;
  tab: ViewTab;
  items?: ItemInput[];
  reportRef?: RefObject<HTMLDivElement>;
  summary?: ReportSummary;
  metrics?: MetricInput[];
  scoreResponse?: ScoreResponse;
};

export default function ResultTabs({
  data,
  tab,
  items: inputItems = [],
  reportRef,
  summary,
  metrics: definedMetrics = [],
  scoreResponse,
}: ResultTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const items: AgentItem[] = data?.items ?? [];
  const ranked = useMemo(() => [...items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)), [items]);
  const tierResults = scoreResponse?.tiers ?? [];
  const scoreEntries = useMemo<(ScoreResponse["scores"][number] | AgentItem)[]>(() => {
    if (!scoreResponse) return ranked;
    return [...scoreResponse.scores].sort((a, b) => b.total_score - a.total_score);
  }, [scoreResponse, ranked]);
  const scoreLookup = useMemo(() => {
    if (!scoreResponse) return undefined;
    return new Map(scoreResponse.scores.map((entry) => [entry.id, entry]));
  }, [scoreResponse]);
  const tierOrder = useMemo(() => {
    if (tierResults.length > 0) {
      return tierResults.map((tier) => tier.label);
    }
    return ["S", "A", "B", "C"];
  }, [tierResults]);

  const tierDescriptions: Record<string, string> = {
    S: "LEGENDARY DOMINANCE",
    A: "STABLE GROWTH",
    B: "PROMISING UPSIDE",
    C: "CHALLENGE MODE",
    D: "RISKY BET",
  };

  const tierVisuals: Record<string, { card: string; emblem: string }> = {
    S: {
      card: "border-purple-500/40 bg-gradient-to-br from-purple-950/70 via-slate-950/50 to-black/40",
      emblem: "from-purple-500 via-fuchsia-500 to-rose-500",
    },
    A: {
      card: "border-emerald-500/40 bg-gradient-to-br from-emerald-950/60 via-slate-950/50 to-black/40",
      emblem: "from-emerald-500 via-cyan-500 to-teal-400",
    },
    B: {
      card: "border-sky-500/30 bg-gradient-to-br from-slate-900/70 via-sky-950/40 to-black/40",
      emblem: "from-sky-500 via-indigo-500 to-purple-500",
    },
    C: {
      card: "border-amber-500/30 bg-gradient-to-br from-amber-950/50 via-slate-950/50 to-black/40",
      emblem: "from-amber-500 via-orange-500 to-rose-500",
    },
    D: {
      card: "border-rose-500/30 bg-gradient-to-br from-rose-950/50 via-slate-950/50 to-black/40",
      emblem: "from-rose-500 via-red-500 to-orange-500",
    },
  };

  const chartPalette = ["#047857", "#059669", "#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#ccfbf1"];
  const chipClasses = [
    "border border-white/10 bg-emerald-500/40 text-white",
    "border border-white/10 bg-emerald-400/30 text-emerald-50",
    "border border-white/10 bg-emerald-300/20 text-emerald-100",
    "border border-white/10 bg-emerald-200/10 text-emerald-100",
    "border border-white/10 bg-emerald-100/10 text-emerald-200",
    "border border-white/10 bg-emerald-50/10 text-emerald-200",
  ];

  const metricLegend = useMemo(
    () =>
      definedMetrics
        .map((metric, index) => ({
          name: metric.name,
          color: chartPalette[index % chartPalette.length],
          chipClass: chipClasses[index % chipClasses.length],
        }))
        .filter((entry) => entry.name),
    [definedMetrics],
  );

  const metricColorMap = useMemo(() => {
    const map = new Map<string, { color: string; chipClass: string }>();
    metricLegend.forEach((entry) => {
      map.set(entry.name, { color: entry.color, chipClass: entry.chipClass });
    });
    return map;
  }, [metricLegend]);

  const metricKeys = useMemo(() => {
    const keys = new Set<string>();
    metricLegend.forEach((entry) => keys.add(entry.name));
    items.forEach((item) => {
      Object.keys(item.contrib ?? {}).forEach((key) => keys.add(key));
    });
    return [...keys];
  }, [items, metricLegend]);

  const radarData = useMemo(
    () => ranked.slice(0, 5).map((item) => ({ name: item.id, ...(item.contrib ?? {}), score: item.score ?? 0 })),
    [ranked],
  );

  const nameMap = useMemo(() => new Map(inputItems.map((item) => [item.id, item.name ?? item.id])), [inputItems]);

  const topReasons = useMemo(
    () =>
      ranked.slice(0, 3).map((item, index) => ({
        index: index + 1,
        label: nameMap.get(item.id) ?? item.id,
        score: item.score ?? 0,
        reason: item.reason,
      })),
    [ranked, nameMap],
  );

  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  return (
    <div ref={containerRef} className="flex h-full flex-col gap-4">
      {metricLegend.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-100">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200">指標凡例</span>
          {metricLegend.map((entry) => (
            <span key={entry.name} className={clsx("flex items-center gap-2 rounded-full px-3 py-1", entry.chipClass)}>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden
              />
              {entry.name}
            </span>
          ))}
        </div>
      )}

      {tab === "tier" && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {(scoreResponse ? tierOrder : ["S", "A", "B", "C"]).map((tier) => {
            const tierData = scoreResponse ? tierResults.find((entry) => entry.label === tier) : undefined;
            const tierItems = scoreResponse
              ? tierData?.items ?? []
              : ranked.filter((item) => (item.tier ?? "").toUpperCase() === tier.toUpperCase());

            const decoratedItems = tierItems
              .map((item) => {
                const scoreEntry = scoreLookup?.get(item.id);
                const scoreValue = scoreResponse
                  ? Math.max(0, Math.min(1, scoreEntry?.total_score ?? (item as any).score ?? 0))
                  : Math.max(0, Math.min(1, (item as AgentItem).score ?? 0));
                const label = scoreResponse
                  ? scoreEntry?.name || (item as any).name || nameMap.get(item.id) || item.id
                  : nameMap.get(item.id) ?? (item as AgentItem).id;
                const reasonText = scoreResponse
                  ? scoreEntry?.main_reason || scoreEntry?.criteria_breakdown?.[0]?.reason
                  : (item as AgentItem).reason;
                const criteria = scoreResponse
                  ? scoreEntry?.top_criteria?.length
                    ? scoreEntry.top_criteria
                    : (scoreEntry?.criteria_breakdown ?? [])
                        .slice()
                        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                        .slice(0, 3)
                        .map((entry) => entry.key)
                  : Object.entries((item as AgentItem).contrib ?? {})
                      .map(([key, value]) => ({ key, value: Number(value) }))
                      .filter((entry) => Number.isFinite(entry.value))
                      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
                      .slice(0, 3)
                      .map((entry) => entry.key);
                return { item, scoreEntry, scoreValue, label, reasonText, criteria };
              })
              .sort((a, b) => b.scoreValue - a.scoreValue);

            const averageScore = decoratedItems.length
              ? decoratedItems.reduce((sum, entry) => sum + entry.scoreValue, 0) / decoratedItems.length
              : 0;
            const tierVisual = tierVisuals[tier] ?? {
              card: "border-white/10 bg-slate-900/70",
              emblem: "from-slate-500 to-slate-700",
            };

            return (
              <div
                key={tier}
                className={clsx(
                  "relative overflow-hidden rounded-3xl p-5 text-white shadow-[0_0_40px_rgba(15,118,110,0.25)]",
                  tierVisual.card,
                )}
              >
                <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(120deg, rgba(255,255,255,0.08), rgba(2,6,23,0.8))" }} />
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-white/60">Tier {tier}</p>
                    <p className="mt-1 text-2xl font-black tracking-wide">{tierDescriptions[tier] ?? "TIER"}</p>
                    <p className="text-xs text-white/70">{tierData?.definition ?? "エンブレム化された強さシグナル"}</p>
                  </div>
                  <div className="flex flex-col items-end text-right">
                    <div
                      className={clsx(
                        "flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/40 bg-gradient-to-br text-lg font-black",
                        tierVisual.emblem,
                      )}
                    >
                      {tier}
                    </div>
                    <TierBadge tier={tier} />
                  </div>
                </div>

                <dl className="relative mt-5 grid grid-cols-3 gap-3 text-[11px] uppercase text-white/60">
                  <div>
                    <dt>企業数</dt>
                    <dd className="text-lg font-semibold text-white">{decoratedItems.length}</dd>
                  </div>
                  <div>
                    <dt>平均スコア</dt>
                    <dd className="text-lg font-semibold text-emerald-200">{(averageScore * 100).toFixed(1)}%</dd>
                  </div>
                  <div>
                    <dt>トップ企業</dt>
                    <dd className="truncate text-base font-semibold text-white">{decoratedItems[0]?.label ?? "-"}</dd>
                  </div>
                </dl>

                <div className="relative mt-6 max-h-48 space-y-3 overflow-y-auto pr-1">
                  {decoratedItems.map((entry) => (
                    <div key={entry.item.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white" title={entry.label}>
                            {entry.label}
                          </p>
                          <p className="text-[11px] text-white/60">{entry.item.id}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-emerald-200">{(entry.scoreValue * 100).toFixed(1)}%</p>
                          <div className="mt-1 h-1.5 w-24 rounded-full bg-white/10">
                            <div
                              className="h-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                              style={{ width: `${entry.scoreValue * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      {entry.reasonText && <p className="mt-2 text-xs text-white/70">{entry.reasonText}</p>}
                      {entry.criteria.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {entry.criteria.map((criterion) => (
                            <span
                              key={`${entry.item.id}-${criterion}`}
                              className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/70"
                            >
                              {criterion}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {decoratedItems.length === 0 && <p className="text-sm text-white/70">該当なし</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "rank" && (
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
          <table className="min-w-full text-sm">
            <thead className="bg-emerald-50/80 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100">
              <tr>
                <th className="px-3 py-2 text-left">順位</th>
                <th className="px-3 py-2 text-left">候補</th>
                <th className="px-3 py-2 text-left">Tier</th>
                <th className="px-3 py-2">主要指標</th>
                <th className="px-3 py-2 text-right">スコア</th>
              </tr>
            </thead>
            <tbody>
              {scoreEntries.map((entry, idx) => {
                const tier = (entry as any).tier ?? scoreLookup?.get(entry.id)?.tier;
                const scoreValue = Math.max(
                  0,
                  Math.min(1, (entry as any).total_score ?? (entry as any).score ?? scoreLookup?.get(entry.id)?.total_score ?? 0),
                );
                const displayName =
                  (entry as any).name ?? scoreLookup?.get(entry.id)?.name ?? nameMap.get(entry.id) ?? entry.id;
                const reasonText =
                  (entry as any).main_reason ?? (entry as any).reason ?? scoreLookup?.get(entry.id)?.main_reason;
                const structuredEntry = scoreLookup?.get(entry.id);
                const breakdownEntries = structuredEntry?.criteria_breakdown ?? [];
                const sources = structuredEntry?.sources ?? [];
                const riskNotesSource = structuredEntry?.risk_notes
                  ?? (isScoreResponseEntry(entry) ? entry.risk_notes : (entry as AgentItem).risk_notes);
                const riskNotes = Array.isArray(riskNotesSource)
                  ? riskNotesSource
                      .map((note) => (typeof note === "string" ? note.trim() : ""))
                      .filter((note) => note.length > 0)
                  : [];
                const topCriteria = structuredEntry?.top_criteria?.length
                  ? structuredEntry.top_criteria
                  : breakdownEntries
                      .slice()
                      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                      .slice(0, 3)
                      .map((item) => item.key);
                const contribEntries = !scoreResponse
                  ? Object.entries((entry as AgentItem).contrib ?? {})
                      .map(([key, value]) => ({ key, value: Number(value) }))
                      .filter((tokenValue) => Number.isFinite(tokenValue.value))
                      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
                      .slice(0, 3)
                  : [];
                const isExpanded = expandedRow === entry.id;
                return (
                  <Fragment key={entry.id}>
                    <tr
                      className={clsx(
                        "border-t border-slate-200/70 transition hover:bg-emerald-50/40 dark:border-slate-700/60 dark:hover:bg-emerald-900/20",
                        scoreResponse ? "cursor-pointer" : undefined,
                      )}
                      onClick={
                        scoreResponse ? () => setExpandedRow((prev) => (prev === entry.id ? null : entry.id)) : undefined
                      }
                    >
                      <td className="px-3 py-3 font-semibold text-slate-600 dark:text-slate-300">{idx + 1}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{displayName}</div>
                        <div className="text-xs text-text-muted">{entry.id}</div>
                      </td>
                      <td className="px-3 py-3">
                        <TierBadge tier={tier} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {scoreResponse ? (
                            topCriteria.length > 0 ? (
                              topCriteria.map((criterion) => (
                                <span
                                  key={`${entry.id}-${criterion}`}
                                  className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-200"
                                >
                                  {criterion}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-text-muted">データ不足</span>
                            )
                          ) : contribEntries.length === 0 ? (
                            <span className="text-xs text-text-muted">データ不足</span>
                          ) : (
                            contribEntries.map((tokenEntry) => {
                              const token = metricColorMap.get(tokenEntry.key);
                              return (
                                <span
                                  key={tokenEntry.key}
                                  className={clsx("rounded-full px-3 py-1 text-xs font-semibold", token?.chipClass ?? "bg-emerald-100 text-emerald-800")}
                                >
                                  {tokenEntry.key}: {(tokenEntry.value * 100).toFixed(0)}%
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">{(scoreValue * 100).toFixed(1)}%</span>
                          <div className="h-2 w-32 rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                            <div
                              className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                              style={{ width: `${scoreValue * 100}%` }}
                            />
                          </div>
                          {reasonText && <span className="self-start text-xs text-text-muted">{reasonText}</span>}
                        </div>
                      </td>
                    </tr>
                    {scoreResponse && isExpanded && (
                      <tr
                        className="border-t border-emerald-200/60 bg-emerald-50/60 dark:border-emerald-800/60 dark:bg-emerald-950/40"
                      >
                        <td colSpan={5} className="px-4 py-4">
                          <div className="space-y-4">
                            <section className="space-y-2">
                              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                                総評
                              </div>
                              {reasonText ? (
                                <p className="text-sm text-slate-700 dark:text-slate-200">{reasonText}</p>
                              ) : (
                                <p className="text-xs text-text-muted">AIが総評を返しませんでした。</p>
                              )}
                              {topCriteria.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {topCriteria.map((criterion) => (
                                    <span
                                      key={`${entry.id}-summary-${criterion}`}
                                      className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-200"
                                    >
                                      {criterion}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </section>

                            <section className="space-y-2">
                              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                                指標内訳
                              </div>
                              {breakdownEntries.length === 0 ? (
                                <div className="text-xs text-text-muted">AIが指標ごとのスコアを返しませんでした。</div>
                              ) : (
                                <div className="overflow-hidden rounded-lg border border-emerald-200/60 bg-white/80 text-xs dark:border-emerald-800/60 dark:bg-slate-900/80">
                                  <table className="min-w-full text-left">
                                    <thead className="bg-emerald-100/70 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
                                      <tr>
                                        <th className="px-3 py-2">指標</th>
                                        <th className="px-3 py-2">重み</th>
                                        <th className="px-3 py-2">スコア</th>
                                        <th className="px-3 py-2">理由</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {breakdownEntries.map((item) => (
                                        <tr key={`${entry.id}-${item.key}`} className="border-t border-emerald-200/60 dark:border-emerald-800/60">
                                          <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{item.key}</td>
                                          <td className="px-3 py-2">{item.weight}</td>
                                          <td className="px-3 py-2">{(Math.max(0, Math.min(1, item.score)) * 100).toFixed(1)}%</td>
                                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{item.reason}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </section>

                            <section className="space-y-2">
                              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                                リスク・懸念点
                              </div>
                              {riskNotes.length === 0 ? (
                                <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
                                  特筆すべきリスクは検出されませんでした。
                                </div>
                              ) : (
                                <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-200">
                                  {riskNotes.map((note, index) => (
                                    <li key={`${entry.id}-risk-${index}`} className="flex items-start gap-2">
                                      <span className="mt-0.5 text-emerald-600 dark:text-emerald-300">•</span>
                                      <span className="leading-snug">{note}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </section>

                            <section className="space-y-2">
                              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                                参考URL
                              </div>
                              {sources.length > 0 ? (
                                <ul className="mt-1 space-y-2 text-xs">
                                  {sources.map((source) => {
                                    const domain = getReadableDomain(source.url);
                                    return (
                                      <li key={source.url} className="space-y-1">
                                        <a
                                          href={source.url}
                                          target="_blank"
                                          className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-sky-400"
                                          rel="noreferrer"
                                        >
                                          <span>{source.title?.trim() || source.url}</span>
                                        </a>
                                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                                          {domain && (
                                            <span className="rounded-full bg-slate-200/80 px-2 py-0.5 dark:bg-slate-800/70">
                                              {domain}
                                            </span>
                                          )}
                                          {source.note && <span>{source.note}</span>}
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : (
                                <div className="text-xs text-text-muted">外部参照はありません。</div>
                              )}
                            </section>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "cards" && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ranked.map((item) => {
            const structuredEntryCard = scoreLookup?.get(item.id);
            const cardRiskNotesSource = structuredEntryCard?.risk_notes ?? item.risk_notes;
            const cardRiskNotes = Array.isArray(cardRiskNotesSource)
              ? cardRiskNotesSource
                  .map((note) => (typeof note === "string" ? note.trim() : ""))
                  .filter((note) => note.length > 0)
              : [];
            const cardSources = (
              structuredEntryCard?.sources ??
              (item.sources ?? []).map((source) => ({
                url: source.url,
                title: source.title,
                note: undefined as string | undefined,
              }))
            ).filter((source) => source && typeof source.url === "string");

            return (
              <div
                key={item.id}
                className="space-y-3 rounded-xl border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{nameMap.get(item.id) ?? item.id}</div>
                  <TierBadge tier={item.tier} />
                </div>
                <div className="space-y-2 text-sm text-text-muted">
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-200">
                    <span className="font-semibold">総合スコア</span>
                    <span>{((item.score ?? 0) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                      style={{ width: `${Math.max(0, Math.min(1, item.score ?? 0)) * 100}%` }}
                    />
                  </div>
                </div>
                {item.reason && (
                  <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3 text-sm leading-relaxed text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100">
                    {item.reason}
                  </div>
                )}
                <div className="space-y-2 text-xs">
                  <div className="font-semibold text-emerald-800 dark:text-emerald-200">指標別スコア</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(item.contrib ?? {}).length === 0 && (
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                        データ不足
                      </span>
                    )}
                    {Object.entries(item.contrib ?? {})
                      .map(([key, value]) => ({ key, value: Number(value) }))
                      .filter((entry) => Number.isFinite(entry.value))
                      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
                      .map((entry) => {
                        const token = metricColorMap.get(entry.key);
                        return (
                          <span
                            key={entry.key}
                            className={clsx("rounded-full px-3 py-1 font-semibold", token?.chipClass ?? "bg-emerald-100 text-emerald-800")}
                          >
                            {entry.key}: {(entry.value * 100).toFixed(1)}%
                          </span>
                        );
                      })}
                  </div>
                </div>

                {cardRiskNotes.length > 0 && (
                  <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100">
                    <div className="font-semibold">リスク・懸念点</div>
                    <ul className="space-y-1 pt-1">
                      {cardRiskNotes.slice(0, 4).map((note, index) => (
                        <li key={`${item.id}-card-risk-${index}`} className="flex items-start gap-2">
                          <span className="mt-0.5">•</span>
                          <span className="leading-snug">{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {cardSources.length > 0 && (
                  <div className="space-y-2 text-xs">
                    <div className="font-semibold text-emerald-800 dark:text-emerald-200">参考URL</div>
                    <ul className="space-y-1">
                      {cardSources.slice(0, 3).map((source) => {
                        const domain = getReadableDomain(source.url);
                        return (
                          <li key={source.url} className="space-y-0.5">
                            <a className="text-blue-600 hover:underline dark:text-sky-400" href={source.url} target="_blank" rel="noreferrer">
                              {source.title?.trim() || source.url}
                            </a>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                              {domain && (
                                <span className="rounded-full bg-slate-200/80 px-2 py-0.5 dark:bg-slate-800/70">{domain}</span>
                              )}
                              {source.note && <span>{source.note}</span>}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "radar" && (
        <div className="h-[420px] rounded-xl border border-slate-200 bg-surface-strong p-3 shadow-sm dark:border-slate-800">
          {metricKeys.length === 0 ? (
            <div className="text-sm text-text-muted">contrib が無いためレーダー表示できません。</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="name" />
                <PolarRadiusAxis />
                {metricKeys.map((metric) => {
                  const token = metricColorMap.get(metric);
                  return (
                    <Radar
                      key={metric}
                      name={metric}
                      dataKey={metric}
                      stroke={token?.color ?? "#34d399"}
                      fill={token?.color ?? "#34d399"}
                      strokeOpacity={0.9}
                      fillOpacity={0.2}
                    />
                  );
                })}
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {tab === "report" && (
        <article
          ref={reportRef}
          className="rounded-xl border border-slate-200 bg-surface-strong p-6 text-sm leading-relaxed text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100"
        >
          {summary ? (
            <>
              <h2 className="text-xl font-semibold">{summary.title}</h2>
              <p className="text-text-muted">{summary.subtitle}</p>
              {topReasons.length > 0 && (
                <section className="mt-4 rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-700/60 dark:bg-emerald-900/40">
                  <h3 className="text-base font-semibold text-emerald-900 dark:text-emerald-100">上位3件のポイント</h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {topReasons.map((entry) => (
                      <li key={entry.index} className="flex flex-col gap-1 rounded-lg bg-white/60 p-2 dark:bg-slate-900/60">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {entry.index}位 {entry.label}
                          </span>
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                            {Math.round(entry.score * 100)}%
                          </span>
                        </div>
                        <div className="text-xs text-text-muted">
                          {entry.reason ?? "総合スコアで高評価"}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {summary.sections.map((section) => (
                <section key={section.title} className="mt-4 space-y-2">
                  <h3 className="text-lg font-semibold">{section.title}</h3>
                  <ul className="space-y-1">
                    {section.paragraphs.map((paragraph, index) => (
                      <li key={`${section.title}-${index}`} className="flex gap-2">
                        <span className="mt-0.5 text-text-muted">•</span>
                        <span>{paragraph}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </>
          ) : (
            <div className="text-sm text-text-muted">評価要約を表示するにはスコアリングを実行してください。</div>
          )}
        </article>
      )}

      {tab === "json" && (
        <pre className="h-[420px] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-3 text-xs text-slate-100 dark:border-slate-800">
{JSON.stringify(scoreResponse ?? data ?? {}, null, 2)}
        </pre>
      )}
    </div>
  );
}
