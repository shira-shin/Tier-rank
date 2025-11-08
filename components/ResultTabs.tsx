"use client";

import { useMemo, useRef, type RefObject } from "react";
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
import type { AgentItem, AgentResult, ItemInput, MetricInput } from "@/lib/types";
import type { ReportSummary } from "@/lib/report";

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
        "inline-flex min-w-[2rem] items-center justify-center rounded-full bg-gradient-to-r px-2 py-0.5 text-xs font-semibold text-white",
        map[tier ?? ""] ?? "from-slate-500 to-slate-400",
      )}
    >
      {tier ?? "-"}
    </span>
  );
}

export type ViewTab = "tier" | "rank" | "cards" | "radar" | "report" | "json";

type ResultTabsProps = {
  data?: AgentResult;
  tab: ViewTab;
  items?: ItemInput[];
  reportRef?: RefObject<HTMLDivElement>;
  summary?: ReportSummary;
  metrics?: MetricInput[];
};

export default function ResultTabs({
  data,
  tab,
  items: inputItems = [],
  reportRef,
  summary,
  metrics: definedMetrics = [],
}: ResultTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const items: AgentItem[] = data?.items ?? [];
  const ranked = useMemo(() => [...items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)), [items]);

  const chartPalette = ["#047857", "#059669", "#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#ccfbf1"];
  const chipClasses = [
    "bg-emerald-600 text-white",
    "bg-emerald-500 text-white",
    "bg-emerald-400 text-emerald-950",
    "bg-emerald-300 text-emerald-900",
    "bg-emerald-200 text-emerald-800",
    "bg-emerald-100 text-emerald-700",
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

  return (
    <div ref={containerRef} className="flex h-full flex-col gap-4">
      {metricLegend.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-50/80 p-3 text-xs font-medium text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-100">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">指標凡例</span>
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
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {["S", "A", "B", "C"].map((tier) => (
            <div
              key={tier}
              className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/50"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="font-semibold">Tier {tier}</div>
                <TierBadge tier={tier} />
              </div>
              <ul className="space-y-3">
                {ranked
                  .filter((item) => item.tier === tier)
                  .map((item) => (
                    <li key={item.id} className="space-y-1 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate" title={nameMap.get(item.id) ?? item.id}>
                          {nameMap.get(item.id) ?? item.id}
                        </span>
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                          {((item.score ?? 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                          style={{ width: `${Math.max(0, Math.min(1, item.score ?? 0)) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                {ranked.filter((item) => item.tier === tier).length === 0 && (
                  <li className="text-sm text-text-muted">該当なし</li>
                )}
              </ul>
            </div>
          ))}
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
              {ranked.map((item, idx) => {
                const contribEntries = Object.entries(item.contrib ?? {})
                  .map(([key, value]) => ({ key, value: Number(value) }))
                  .filter((entry) => Number.isFinite(entry.value))
                  .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
                  .slice(0, 3);
                return (
                  <tr key={item.id} className="border-t border-slate-200/70 dark:border-slate-700/60">
                    <td className="px-3 py-3 font-semibold text-slate-600 dark:text-slate-300">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{nameMap.get(item.id) ?? item.id}</div>
                      <div className="text-xs text-text-muted">{item.id}</div>
                    </td>
                    <td className="px-3 py-3">
                      <TierBadge tier={item.tier} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        {contribEntries.length === 0 && <span className="text-xs text-text-muted">データ不足</span>}
                        {contribEntries.map((entry) => {
                          const token = metricColorMap.get(entry.key);
                          return (
                            <span
                              key={entry.key}
                              className={clsx("rounded-full px-3 py-1 text-xs font-semibold", token?.chipClass ?? "bg-emerald-100 text-emerald-800")}
                            >
                              {entry.key}: {(entry.value * 100).toFixed(0)}%
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">{((item.score ?? 0) * 100).toFixed(1)}%</span>
                        <div className="h-2 w-32 rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                            style={{ width: `${Math.max(0, Math.min(1, item.score ?? 0)) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "cards" && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ranked.map((item) => (
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
              {item.sources?.length ? (
                <ul className="mt-2 space-y-1 text-xs">
                  {item.sources.slice(0, 3).map((source) => (
                    <li key={source.url}>
                      <a className="text-blue-600 hover:underline dark:text-sky-400" href={source.url} target="_blank">
                        {source.title}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
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
{JSON.stringify(data ?? {}, null, 2)}
        </pre>
      )}
    </div>
  );
}
