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
import type { AgentItem, AgentResult, ItemInput } from "@/lib/types";
import type { ReportSummary } from "@/lib/report";

function TierBadge({ tier }: { tier?: string }) {
  const map: Record<string, string> = {
    S: "bg-purple-600",
    A: "bg-emerald-600",
    B: "bg-amber-600",
    C: "bg-rose-600",
  };
  return (
    <span className={clsx("rounded px-2 py-0.5 text-xs text-white", map[tier ?? ""] ?? "bg-slate-400")}>
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
};

export default function ResultTabs({
  data,
  tab,
  items: inputItems = [],
  reportRef,
  summary,
}: ResultTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const items: AgentItem[] = data?.items ?? [];
  const ranked = useMemo(() => [...items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)), [items]);

  const metricKeys = useMemo(() => {
    const target = items.find((item) => item.contrib && Object.keys(item.contrib).length > 0);
    return target ? Object.keys(target.contrib!) : [];
  }, [items]);

  const radarData = useMemo(
    () => ranked.slice(0, 5).map((item) => ({ name: item.id, ...(item.contrib ?? {}), score: item.score ?? 0 })),
    [ranked],
  );

  const nameMap = useMemo(() => new Map(inputItems.map((item) => [item.id, item.name ?? item.id])), [inputItems]);

  return (
    <div ref={containerRef} className="flex h-full flex-col gap-4">
      {tab === "tier" && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {["S", "A", "B", "C"].map((tier) => (
            <div
              key={tier}
              className="rounded-xl border border-slate-200 bg-surface-strong p-4 shadow-sm dark:border-slate-800"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="font-semibold">Tier {tier}</div>
                <TierBadge tier={tier} />
              </div>
              <ul className="space-y-2">
                {ranked
                  .filter((item) => item.tier === tier)
                  .map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate" title={nameMap.get(item.id) ?? item.id}>
                        {nameMap.get(item.id) ?? item.id}
                      </span>
                      <span className="text-text-muted">{((item.score ?? 0) * 100).toFixed(1)}%</span>
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
        <div className="overflow-auto rounded-xl border border-slate-200 bg-surface-strong shadow-sm dark:border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-3 py-2 text-left">順位</th>
                <th className="px-3 py-2 text-left">候補</th>
                <th className="px-3 py-2 text-left">Tier</th>
                <th className="px-3 py-2 text-right">スコア</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((item, idx) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{nameMap.get(item.id) ?? item.id}</div>
                    <div className="text-xs text-text-muted">{item.id}</div>
                  </td>
                  <td className="px-3 py-2">
                    <TierBadge tier={item.tier} />
                  </td>
                  <td className="px-3 py-2 text-right">{((item.score ?? 0) * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "cards" && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ranked.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-surface-strong p-4 shadow-sm dark:border-slate-800"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="font-semibold">{nameMap.get(item.id) ?? item.id}</div>
                <TierBadge tier={item.tier} />
              </div>
              <div className="mb-2 text-sm text-text-muted">スコア: {((item.score ?? 0) * 100).toFixed(1)}%</div>
              {item.reason && <div className="text-sm leading-relaxed">{item.reason}</div>}
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
                {metricKeys.map((metric) => (
                  <Radar key={metric} name={metric} dataKey={metric} strokeOpacity={1} fillOpacity={0.25} />
                ))}
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
