"use client";
import { useRef, useState } from "react";
import type { ScorePayload, AgentResult } from "@/lib/types";
import Segmented from "@/components/Segmented";
import ResultTabs, { type ViewTab } from "@/components/ResultTabs";
import { exportCSV, exportJSON, exportPNG } from "@/lib/export";

const PRESET_ITEMS = `[
  { "id":"A", "name":"候補A" },
  { "id":"B", "name":"候補B" },
  { "id":"C", "name":"候補C" }
]`;

const PRESET_METRICS_NUM = `[
  { "name":"総合", "type":"numeric", "direction":"MAX", "weight":1 }
]`;

const PRESET_METRICS_BAL = `[
  { "name":"価格", "type":"numeric", "direction":"MIN", "weight":0.4 },
  { "name":"性能", "type":"numeric", "direction":"MAX", "weight":0.4 },
  { "name":"評判", "type":"likert", "direction":"MAX", "weight":0.2 }
]`;

export default function ScoreForm() {
  const [itemsText, setItemsText] = useState(PRESET_ITEMS);
  const [metricsText, setMetricsText] = useState(PRESET_METRICS_NUM);
  const [useWeb, setUseWeb] = useState(false);
  const [err, setErr] = useState<string|undefined>();
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<AgentResult|undefined>();
  const [tab, setTab] = useState<ViewTab>("tier");
  const viewRef = useRef<HTMLDivElement>(null);

  async function run() {
    setErr(undefined);
    let payload: ScorePayload;
    try {
      payload = {
        items: JSON.parse(itemsText),
        metrics: JSON.parse(metricsText),
        use_web_search: useWeb,
      };
    } catch {
      setErr("JSONの形式が不正です。");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/projects/demo/agent/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      setRes(j);
    } catch {
      setErr("API呼び出しに失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  function exportAsCSV() {
    const rows = (res?.items ?? []).map(i => ({
      id: i.id,
      tier: i.tier,
      score: i.score,
      reason: i.reason
    }));
    exportCSV(rows, "tier-rank.csv");
  }

  async function exportAsPNG() {
    if (!viewRef.current) return;
    await exportPNG(viewRef.current, "tier-rank.png");
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* 左側：入力 */}
      <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-3">
        <h2 className="text-lg font-semibold">入力</h2>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">プリセット:</span>
          <button onClick={()=>setItemsText(PRESET_ITEMS)} className="px-2 py-1 text-sm rounded-lg border hover:bg-slate-50">Items</button>
          <button onClick={()=>setMetricsText(PRESET_METRICS_NUM)} className="px-2 py-1 text-sm rounded-lg border hover:bg-slate-50">シンプル指標</button>
          <button onClick={()=>setMetricsText(PRESET_METRICS_BAL)} className="px-2 py-1 text-sm rounded-lg border hover:bg-slate-50">バランス型指標</button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Items（候補の配列）</label>
          <textarea className="w-full h-52 rounded-lg border border-slate-300 p-3 font-mono text-sm"
            value={itemsText} onChange={e=>setItemsText(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Metrics（評価基準の配列）</label>
          <textarea className="w-full h-52 rounded-lg border border-slate-300 p-3 font-mono text-sm"
            value={metricsText} onChange={e=>setMetricsText(e.target.value)} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useWeb} onChange={e=>setUseWeb(e.target.checked)} />
          Web検索を使用（根拠URLを付与）
        </label>

        {err && <div className="text-rose-600 text-sm">{err}</div>}

        <button onClick={run} disabled={loading}
          className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white py-2.5 disabled:opacity-60">
          {loading ? "評価中…" : "スコアリングを実行"}
        </button>
      </div>

      {/* 右側：出力 */}
      <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">出力</h2>
          <Segmented<ViewTab>
            value={tab} onChange={setTab}
            options={[
              { label:"Tier表", value:"tier" },
              { label:"ランキング", value:"rank" },
              { label:"カード", value:"cards" },
              { label:"レーダー", value:"radar" },
              { label:"JSON", value:"json" },
            ]}
          />
        </div>

        {/* エクスポート */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={()=>exportJSON(res ?? {}, "tier-rank.json")}
            className="px-3 py-1.5 text-sm rounded-lg border hover:bg-slate-50">JSON保存</button>
          <button onClick={exportAsCSV}
            className="px-3 py-1.5 text-sm rounded-lg border hover:bg-slate-50">CSV保存</button>
          <button onClick={exportAsPNG}
            className="px-3 py-1.5 text-sm rounded-lg border hover:bg-slate-50">PNG保存（表示中）</button>
        </div>

        <div ref={viewRef}>
          {res ? (
            <ResultTabs data={res} tab={tab} />
          ) : (
            <div className="h-[520px] grid place-items-center text-slate-500 text-sm">
              スコアリングを実行すると結果が表示されます。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
