"use client";

import { useState } from "react";
import type { ScorePayload, AgentResult } from "@/lib/types";

export default function ScoreForm({ onResult }: { onResult: (r: AgentResult) => void }) {
  const [itemsText, setItemsText] = useState(
    `[
  { "id":"i1", "name":"Obj A" },
  { "id":"i2", "name":"Obj B" }
]`,
  );
  const [metricsText, setMetricsText] = useState(
    `[
  { "name":"Score", "type":"numeric", "direction":"MAX", "weight":1 }
]`,
  );
  const [useWeb, setUseWeb] = useState(false);
  const [err, setErr] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function run() {
    setErr(undefined);
    let payload: ScorePayload;
    try {
      payload = {
        items: JSON.parse(itemsText),
        metrics: JSON.parse(metricsText),
        use_web_search: useWeb,
      };
    } catch (error) {
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
      if (!r.ok) {
        const message = await r.text();
        setErr(message || `APIがエラーを返しました (status ${r.status})`);
        return;
      }
      const json = (await r.json()) as AgentResult;
      if (json.error) {
        setErr(json.error);
      }
      onResult(json);
    } catch (error) {
      setErr("API呼び出しに失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Items</label>
        <textarea
          className="w-full h-56 rounded-lg border border-slate-300 p-3 font-mono text-sm"
          value={itemsText}
          onChange={(e) => setItemsText(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Metrics</label>
        <textarea
          className="w-full h-56 rounded-lg border border-slate-300 p-3 font-mono text-sm"
          value={metricsText}
          onChange={(e) => setMetricsText(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={useWeb} onChange={(e) => setUseWeb(e.target.checked)} />
        use_web_search
      </label>
      {err && <div className="text-rose-600 text-sm">{err}</div>}
      <button
        onClick={run}
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white py-2.5 disabled:opacity-60"
      >
        {loading ? "Scoring..." : "Run Scoring"}
      </button>
    </div>
  );
}
