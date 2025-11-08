"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Segmented from "@/components/Segmented";
import ResultTabs, { type ViewTab } from "@/components/ResultTabs";
import type { AgentResult, ItemInput, MetricInput, ScorePayload } from "@/lib/types";
import {
  exportCSV,
  exportJSON,
  exportPNG,
  exportReportDocx,
  exportReportPDF,
} from "@/lib/export";
import { buildReportSummary } from "@/lib/report";

type HistoryEntry = {
  id: string;
  title: string;
  createdAt: number;
  payload: ScorePayload;
  result?: AgentResult;
};

const DEFAULT_ITEMS: ItemInput[] = [
  { id: "A", name: "候補A" },
  { id: "B", name: "候補B" },
  { id: "C", name: "候補C" },
];

const SIMPLE_METRICS: MetricInput[] = [
  { name: "総合", type: "numeric", direction: "MAX", weight: 1 },
];

const BALANCED_METRICS: MetricInput[] = [
  { name: "価格", type: "numeric", direction: "MIN", weight: 0.4 },
  { name: "性能", type: "numeric", direction: "MAX", weight: 0.4 },
  { name: "評判", type: "likert", direction: "MAX", weight: 0.2 },
];

const HISTORY_KEY = "tier-rank-history";

function createHistoryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `history-${Date.now()}`;
}

export default function ScoreForm() {
  const [items, setItems] = useState<ItemInput[]>(() => DEFAULT_ITEMS.map((item) => ({ ...item })));
  const [metrics, setMetrics] = useState<MetricInput[]>(() => SIMPLE_METRICS.map((metric) => ({ ...metric })));
  const [useWeb, setUseWeb] = useState(false);
  const [historyMode, setHistoryMode] = useState(false);
  const [historyTitle, setHistoryTitle] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentResult | undefined>();
  const [tab, setTab] = useState<ViewTab>("tier");
  const viewRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed: HistoryEntry[] = JSON.parse(raw);
        setHistory(parsed);
      }
    } catch {
      setHistory([]);
    }
  }, []);

  const summary = useMemo(() => buildReportSummary(result, items, metrics), [result, items, metrics]);

  function updateItems(index: number, payload: Partial<ItemInput> & { metaNote?: string }) {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const { metaNote, ...rest } = payload;
        const next: ItemInput = {
          ...item,
          ...rest,
        };
        if (metaNote !== undefined) {
          next.meta = { ...(item.meta ?? {}), note: metaNote };
        }
        return next;
      }),
    );
  }

  function addItem() {
    const usedIds = new Set(items.map((item) => item.id));
    let suffix = items.length;
    let candidate = "A";
    while (usedIds.has(candidate)) {
      suffix += 1;
      candidate = String.fromCharCode(65 + (suffix % 26));
    }
    setItems((prev) => [...prev, { id: candidate, name: `候補${candidate}` }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  function updateMetric(index: number, payload: Partial<MetricInput>) {
    setMetrics((prev) => prev.map((metric, idx) => (idx === index ? { ...metric, ...payload } : metric)));
  }

  function addMetric() {
    setMetrics((prev) => [
      ...prev,
      { name: `指標${prev.length + 1}`, type: "numeric", direction: "MAX", weight: 1 },
    ]);
  }

  function removeMetric(index: number) {
    setMetrics((prev) => prev.filter((_, idx) => idx !== index));
  }

  function applyPreset(kind: "items" | "simple" | "balanced") {
    if (kind === "items") {
      setItems(DEFAULT_ITEMS.map((item) => ({ ...item })));
    } else if (kind === "simple") {
      setMetrics(SIMPLE_METRICS.map((metric) => ({ ...metric })));
    } else {
      setMetrics(BALANCED_METRICS.map((metric) => ({ ...metric })));
    }
  }

  function persistHistory(next: HistoryEntry[]) {
    setHistory(next);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }

  function validate(): ScorePayload | undefined {
    if (items.length === 0) {
      setError("候補を1件以上登録してください。");
      return undefined;
    }
    const cleanedItems = items.map((item) => ({
      ...item,
      id: item.id.trim(),
      name: (item.name ?? "").trim() || item.id.trim(),
    }));
    const ids = cleanedItems.map((item) => item.id);
    if (ids.some((id) => !id)) {
      setError("候補IDが未入力です。");
      return undefined;
    }
    if (new Set(ids).size !== ids.length) {
      setError("候補IDが重複しています。");
      return undefined;
    }
    if (metrics.length === 0) {
      setError("評価指標を1件以上設定してください。");
      return undefined;
    }
    const cleanedMetrics: MetricInput[] = [];
    for (const metric of metrics) {
      if (!metric.name.trim()) {
        setError("評価指標名が未入力です。");
        return undefined;
      }
      const weight = Number(metric.weight);
      if (Number.isNaN(weight) || weight <= 0) {
        setError(`「${metric.name}」の重みは正の数で入力してください。`);
        return undefined;
      }
      const threshold =
        metric.threshold !== undefined && metric.threshold !== null
          ? Number(metric.threshold)
          : undefined;
      cleanedMetrics.push({
        ...metric,
        name: metric.name.trim(),
        weight,
        threshold: threshold,
      });
    }
    setError(undefined);
    setItems(cleanedItems.map((item) => ({ ...item })));
    setMetrics(cleanedMetrics.map((metric) => ({ ...metric })));
    return {
      items: cleanedItems,
      metrics: cleanedMetrics,
      use_web_search: useWeb,
    };
  }

  async function run() {
    const payload = validate();
    if (!payload) return;
    setLoading(true);
    try {
      const response = await fetch("/api/projects/demo/agent/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      setResult(json);
      setTab((prev) => (prev === "report" ? "report" : "tier"));
      if (historyMode && historyTitle.trim()) {
        const entry: HistoryEntry = {
          id: createHistoryId(),
          title: historyTitle.trim(),
          createdAt: Date.now(),
          payload,
          result: json,
        };
        persistHistory([entry, ...history]);
      }
    } catch {
      setError("API呼び出しに失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  function exportAsCSV() {
    if (!result?.items?.length) return;
    const rows = result.items.map((item) => ({
      id: item.id,
      tier: item.tier,
      score: item.score,
      reason: item.reason,
    }));
    exportCSV(rows, "tier-rank.csv");
  }

  async function exportAsPNG() {
    if (!viewRef.current) return;
    await exportPNG(viewRef.current, "tier-rank.png");
  }

  async function exportAsPDF() {
    if (!reportRef.current) return;
    await exportReportPDF(reportRef.current, "tier-report.pdf");
  }

  async function exportAsDocx() {
    if (!summary) return;
    await exportReportDocx(summary, "tier-report.docx");
  }

  function handleSaveHistory() {
    if (!historyMode) return;
    const payload = validate();
    if (!payload) return;
    if (!result) {
      setError("レポートを保存するには評価を実行してください。");
      return;
    }
    const title = historyTitle.trim() || `保存済み ${new Date().toLocaleString()}`;
    const entry: HistoryEntry = {
      id: createHistoryId(),
      title,
      createdAt: Date.now(),
      payload,
      result,
    };
    persistHistory([entry, ...history]);
    setHistoryTitle("");
  }

  function handleLoadHistory(entry: HistoryEntry) {
    setItems(entry.payload.items.map((item) => ({ ...item })));
    setMetrics(entry.payload.metrics.map((metric) => ({ ...metric })));
    setUseWeb(Boolean(entry.payload.use_web_search));
    setResult(entry.result);
    setTab("tier");
  }

  function handleDeleteHistory(entryId: string) {
    const next = history.filter((entry) => entry.id !== entryId);
    persistHistory(next);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">評価条件の設定</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-text-muted">プリセット:</span>
            <button
              onClick={() => applyPreset("items")}
              className="rounded-lg border border-slate-300 px-3 py-1.5 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              候補サンプル
            </button>
            <button
              onClick={() => applyPreset("simple")}
              className="rounded-lg border border-slate-300 px-3 py-1.5 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              シンプル指標
            </button>
            <button
              onClick={() => applyPreset("balanced")}
              className="rounded-lg border border-slate-300 px-3 py-1.5 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              バランス指標
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">候補一覧</h3>
            <button
              onClick={addItem}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white shadow-sm transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              候補を追加
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 bg-surface-strong p-4 shadow-sm dark:border-slate-800"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-text-muted">候補 {idx + 1}</span>
                  {items.length > 1 && (
                    <button
                      onClick={() => removeItem(idx)}
                      className="text-sm text-rose-500 hover:underline"
                    >
                      削除
                    </button>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">候補ID</span>
                    <input
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                      value={item.id}
                      onChange={(event) => updateItems(idx, { id: event.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">表示名</span>
                    <input
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                      value={item.name ?? ""}
                      onChange={(event) => updateItems(idx, { name: event.target.value })}
                    />
                  </label>
                </div>
                <label className="mt-3 flex flex-col gap-1 text-sm">
                  <span className="font-medium">補足メモ（任意）</span>
                  <textarea
                    className="min-h-[60px] rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                    value={(item.meta as { note?: string } | undefined)?.note ?? ""}
                    onChange={(event) => updateItems(idx, { metaNote: event.target.value })}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">評価指標</h3>
            <button
              onClick={addMetric}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white shadow-sm transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              指標を追加
            </button>
          </div>

          <div className="space-y-3">
            {metrics.map((metric, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 bg-surface-strong p-4 shadow-sm dark:border-slate-800"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-text-muted">指標 {idx + 1}</span>
                  {metrics.length > 1 && (
                    <button
                      onClick={() => removeMetric(idx)}
                      className="text-sm text-rose-500 hover:underline"
                    >
                      削除
                    </button>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">指標名</span>
                    <input
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                      value={metric.name}
                      onChange={(event) => updateMetric(idx, { name: event.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">タイプ</span>
                    <select
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                      value={metric.type}
                      onChange={(event) => updateMetric(idx, { type: event.target.value as MetricInput["type"] })}
                    >
                      <option value="numeric">数値</option>
                      <option value="boolean">真偽</option>
                      <option value="likert">リッカート</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">評価方向</span>
                    <select
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                      value={metric.direction}
                      onChange={(event) => updateMetric(idx, { direction: event.target.value as MetricInput["direction"] })}
                    >
                      <option value="MAX">大きいほど良い</option>
                      <option value="MIN">小さいほど良い</option>
                      <option value="TARGET">目標値重視</option>
                      <option value="LOG">ログ変換</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">重み</span>
                    <input
                      type="number"
                      step="0.1"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                      value={metric.weight}
                      onChange={(event) => updateMetric(idx, { weight: Number(event.target.value) })}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm md:col-span-2">
                    <span className="font-medium">目標値 / しきい値（任意）</span>
                    <input
                      type="number"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                      value={metric.threshold ?? ""}
                      onChange={(event) =>
                        updateMetric(idx, {
                          threshold: event.target.value === "" ? undefined : Number(event.target.value),
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useWeb}
              onChange={(event) => setUseWeb(event.target.checked)}
            />
            Web検索を使用して根拠URLを取得
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={historyMode}
              onChange={(event) => setHistoryMode(event.target.checked)}
            />
            履歴を保存・再利用する
          </label>

          {historyMode && (
            <div className="rounded-xl border border-slate-200 bg-surface-strong p-4 text-sm shadow-sm dark:border-slate-800">
              <div className="mb-3 font-medium">履歴用タイトル</div>
              <input
                className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                value={historyTitle}
                onChange={(event) => setHistoryTitle(event.target.value)}
                placeholder="例：2024年7月 評価版"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSaveHistory}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  現在の設定を保存
                </button>
                <button
                  onClick={() => setHistoryTitle("")}
                  className="rounded-lg px-3 py-1.5 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  クリア
                </button>
              </div>
            </div>
          )}

          {error && <div className="text-sm text-rose-500">{error}</div>}

          <button
            onClick={run}
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-base font-medium text-white shadow-lg transition hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "評価を実行中…" : "AIでスコアリング"}
          </button>
        </div>

        {historyMode && (
          <div className="space-y-3">
            <h3 className="text-base font-semibold">保存済みの履歴</h3>
            {history.length === 0 && <div className="text-sm text-text-muted">まだ保存された履歴はありません。</div>}
            <ul className="space-y-3">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-surface-strong p-4 text-sm shadow-sm dark:border-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{entry.title}</div>
                      <div className="text-text-muted text-xs">
                        {new Date(entry.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLoadHistory(entry)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        反映
                      </button>
                      <button
                        onClick={() => handleDeleteHistory(entry.id)}
                        className="rounded-lg px-3 py-1.5 text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">評価レポート</h2>
          <Segmented<ViewTab>
            value={tab}
            onChange={setTab}
            options={[
              { label: "Tier表", value: "tier" },
              { label: "ランキング", value: "rank" },
              { label: "カード", value: "cards" },
              { label: "レーダー", value: "radar" },
              { label: "レポート要約", value: "report" },
              { label: "JSON", value: "json" },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportJSON(result ?? {}, "tier-rank.json")}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            JSON保存
          </button>
          <button
            onClick={exportAsCSV}
            disabled={!result?.items?.length}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            CSV保存
          </button>
          <button
            onClick={exportAsPNG}
            disabled={!result}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            PNG保存（表示中）
          </button>
          <button
            onClick={exportAsPDF}
            disabled={!summary}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            PDF出力（要約）
          </button>
          <button
            onClick={exportAsDocx}
            disabled={!summary}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Word出力（要約）
          </button>
        </div>

        <div ref={viewRef} className="min-h-[520px]">
          {result ? (
            <ResultTabs data={result} tab={tab} items={items} reportRef={reportRef} summary={summary} />
          ) : (
            <div className="grid h-full place-items-center rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-text-muted dark:border-slate-700">
              AIに評価させるとここにティア表・ランキング・レポートが表示されます。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
