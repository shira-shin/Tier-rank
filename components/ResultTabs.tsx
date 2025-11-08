"use client";
import { useMemo, useRef } from "react";
import type { AgentResult, AgentItem } from "@/lib/types";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import clsx from "clsx";

function TierBadge({ tier }: { tier?: string }) {
  const map: Record<string, string> = { S: "bg-purple-600", A: "bg-emerald-600", B: "bg-amber-600", C: "bg-rose-600" };
  return (
    <span className={clsx("px-2 py-0.5 rounded text-white text-xs", map[tier ?? ""] ?? "bg-slate-400")}>{tier ?? "-"}</span>
  );
}

export type ViewTab = "tier" | "rank" | "cards" | "radar" | "json";

export default function ResultTabs({
  data,
  tab,
}: { data?: AgentResult; tab: ViewTab }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const items: AgentItem[] = data?.items ?? [];
  const ranked = useMemo(() => [...items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)), [items]);

  const metrics = useMemo(() => {
    const f = items.find((i) => i.contrib && Object.keys(i.contrib).length > 0);
    return f ? Object.keys(f.contrib!) : [];
  }, [items]);

  const radarData = useMemo(
    () => ranked.slice(0, 5).map((i) => ({ name: i.id, ...(i.contrib ?? {}), score: i.score ?? 0 })),
    [ranked],
  );

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      {tab === "tier" && (
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-3">
          {["S", "A", "B", "C"].map((t) => (
            <div key={t} className="rounded-xl bg-white border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-semibold">Tier {t}</div>
                <TierBadge tier={t} />
              </div>
              <ul className="space-y-2">
                {ranked
                  .filter((i) => i.tier === t)
                  .map((i) => (
                    <li key={i.id} className="flex items-center justify-between">
                      <span className="truncate">{i.id}</span>
                      <span className="text-slate-600 text-sm">{((i.score ?? 0) * 100).toFixed(1)}%</span>
                    </li>
                  ))}
                {ranked.filter((i) => i.tier === t).length === 0 && <div className="text-slate-400 text-sm">該当なし</div>}
              </ul>
            </div>
          ))}
        </div>
      )}

      {tab === "rank" && (
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">順位</th>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Tier</th>
                <th className="px-3 py-2 text-right">スコア</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((i, idx) => (
                <tr key={i.id} className="border-t">
                  <td className="px-3 py-2">{idx + 1}</td>
                  <td className="px-3 py-2">{i.id}</td>
                  <td className="px-3 py-2">
                    <TierBadge tier={i.tier} />
                  </td>
                  <td className="px-3 py-2 text-right">{((i.score ?? 0) * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "cards" && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {ranked.map((i) => (
            <div key={i.id} className="rounded-xl bg-white border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">{i.id}</div>
                <TierBadge tier={i.tier} />
              </div>
              <div className="text-sm text-slate-600 mb-2">スコア: {((i.score ?? 0) * 100).toFixed(1)}%</div>
              {i.reason && <div className="text-sm text-slate-700 line-clamp-3">{i.reason}</div>}
              {i.sources?.length ? (
                <ul className="mt-2 space-y-1 text-xs">
                  {i.sources.slice(0, 3).map((s) => (
                    <li key={s.url}>
                      <a className="text-blue-600 hover:underline" href={s.url} target="_blank">
                        {s.title}
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
        <div className="h-[420px] rounded-xl bg-white border border-slate-200 p-3">
          {metrics.length === 0 ? (
            <div className="text-slate-500 text-sm">contrib が無いためレーダー表示できません。</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="name" />
                <PolarRadiusAxis />
                {metrics.map((m) => (
                  <Radar key={m} name={m} dataKey={m} strokeOpacity={1} fillOpacity={0.25} />
                ))}
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {tab === "json" && (
        <pre className="h-[420px] overflow-auto rounded-xl bg-slate-900 text-slate-100 p-3 text-xs">
{JSON.stringify(data ?? {}, null, 2)}
        </pre>
      )}
    </div>
  );
}
