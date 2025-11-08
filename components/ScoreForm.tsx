"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "react-beautiful-dnd";
import clsx from "clsx";
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
import { evalFormula, validateFormula } from "@/lib/formula";

const HISTORY_KEY = "tier-rank-history";

const DEFAULT_ITEMS: ItemInput[] = [
  { id: "A", name: "候補A" },
  { id: "B", name: "候補B" },
  { id: "C", name: "候補C" },
];

const SIMPLE_METRICS: MetricInput[] = [
  { name: "総合", type: "numeric", direction: "MAX", weight: 1, normalize: "none" },
];

const BALANCED_METRICS: MetricInput[] = [
  { name: "価格", type: "numeric", direction: "MIN", weight: 0.4, normalize: "minmax" },
  { name: "性能", type: "numeric", direction: "MAX", weight: 0.4, normalize: "minmax" },
  { name: "評判", type: "likert", direction: "MAX", weight: 0.2 },
];

type HistoryEntry = {
  id: string;
  title: string;
  createdAt: number;
  payload: ScorePayload;
  result?: AgentResult;
  summaryText?: string;
};

function createHistoryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `history-${Date.now()}`;
}

function reorderList<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

function buildDummyScope(names: string[]) {
  const scope: Record<string, number> = {};
  names.forEach((name, index) => {
    scope[name] = Number(((index + 1) / (names.length + 1)).toFixed(2));
  });
  scope.score = 0.75;
  return scope;
}

export default function ScoreForm() {
  const [items, setItems] = useState<ItemInput[]>(() => DEFAULT_ITEMS.map((item) => ({ ...item })));
  const [metrics, setMetrics] = useState<MetricInput[]>(() => SIMPLE_METRICS.map((metric) => ({ ...metric })));
  const [useWeb, setUseWeb] = useState(false);
  const [historyEnabled, setHistoryEnabled] = useState(false);
  const [historyTitle, setHistoryTitle] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentResult | undefined>();
  const [tab, setTab] = useState<ViewTab>("tier");
  const [collapsedItems, setCollapsedItems] = useState<Record<string, boolean>>({});
  const [collapsedMetrics, setCollapsedMetrics] = useState<Record<string, boolean>>({});

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

  function persistHistory(next: HistoryEntry[]) {
    setHistory(next);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }

  function updateItems(index: number, payload: Partial<ItemInput> & { metaNote?: string }) {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const { metaNote, ...rest } = payload;
        const next: ItemInput = { ...item, ...rest };
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

  function toggleItemCollapse(index: number) {
    setCollapsedItems((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  function updateMetric(index: number, payload: Partial<MetricInput>) {
    setMetrics((prev) => prev.map((metric, idx) => (idx === index ? { ...metric, ...payload } : metric)));
  }

  function addMetric() {
    setMetrics((prev) => [
      ...prev,
      { name: `指標${prev.length + 1}`, type: "numeric", direction: "MAX", weight: 1, normalize: "none" },
    ]);
  }

  function removeMetric(index: number) {
    setMetrics((prev) => prev.filter((_, idx) => idx !== index));
  }

  function toggleMetricCollapse(index: number) {
    setCollapsedMetrics((prev) => ({ ...prev, [index]: !prev[index] }));
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
    for (let i = 0; i < metrics.length; i += 1) {
      const metric = metrics[i];
      const baseName = metric.name?.trim();
      if (!baseName) {
        setError("評価指標名が未入力です。");
        return undefined;
      }
      const weight = Number(metric.weight ?? 1);
      if (Number.isNaN(weight) || weight <= 0) {
        setError(`「${baseName}」の重みは正の数で入力してください。`);
        return undefined;
      }
      if (metric.type === "formula") {
        if (!metric.formula?.trim()) {
          setError(`「${baseName}」の計算式を入力してください。`);
          return undefined;
        }
        const previousNames = [
          ...metrics
            .slice(0, i)
            .map((m) => m.name.trim())
            .filter(Boolean),
          "score",
        ];
        const formulaError = validateFormula(metric.formula, previousNames);
        if (formulaError) {
          setError(`「${baseName}」の式に誤りがあります: ${formulaError}`);
          return undefined;
        }
      }
      cleanedMetrics.push({
        ...metric,
        name: baseName,
        weight,
        direction: metric.type === "numeric" || metric.type === "likert" ? metric.direction ?? "MAX" : undefined,
        normalize: metric.type === "numeric" ? metric.normalize ?? "none" : undefined,
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
      setTab((prev) => (prev === "json" || prev === "report" ? prev : "tier"));
      if (historyEnabled) {
        const entry: HistoryEntry = {
          id: createHistoryId(),
          title: historyTitle.trim() || `保存済み ${new Date().toLocaleString()}`,
          createdAt: Date.now(),
          payload,
          result: json,
          summaryText: buildReportSummary(json, payload.items, payload.metrics)?.plainText,
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

  function handleDragEnd(resultDrag: DropResult) {
    if (!resultDrag.destination) return;
    const { source, destination } = resultDrag;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (source.droppableId === "items" && destination.droppableId === "items") {
      setItems((prev) => reorderList(prev, source.index, destination.index));
    }
    if (source.droppableId === "metrics" && destination.droppableId === "metrics") {
      setMetrics((prev) => reorderList(prev, source.index, destination.index));
    }
  }

  return (
    <div className="relative pb-32">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">評価条件の設定</h2>
                <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
                  <span>プリセット:</span>
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
            </div>

            <div className="rounded-2xl border border-sky-400/50 bg-sky-50/80 p-4 shadow-sm backdrop-blur dark:border-sky-500/40 dark:bg-sky-900/20">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-sky-900 dark:text-sky-100">候補一覧</span>
                  <span className="rounded-md bg-sky-600 px-2 py-0.5 text-xs font-semibold text-white">{items.length} 件</span>
                </div>
                <button
                  onClick={addItem}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700"
                >
                  候補を追加
                </button>
              </div>

              <Droppable droppableId="items">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                    {items.map((item, idx) => {
                      const collapsed = collapsedItems[idx];
                      const metaNote = (item.meta as { note?: string } | undefined)?.note ?? "";
                      return (
                        <Draggable key={`item-${idx}-${item.id}`} draggableId={`item-${idx}-${item.id}`} index={idx}>
                          {(dragProvided, snapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className={clsx(
                                "rounded-xl border border-sky-400/50 bg-white/80 p-4 shadow-sm transition dark:bg-slate-950/60",
                                snapshot.isDragging ? "ring-2 ring-sky-400" : undefined,
                              )}
                            >
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white"
                                  >
                                    {idx + 1}
                                  </span>
                                  <span className="text-sm font-semibold text-sky-900 dark:text-sky-100">候補 {idx + 1}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => toggleItemCollapse(idx)}
                                    className="rounded-md border border-sky-200 px-2 py-1 text-xs text-sky-700 transition hover:bg-sky-100 dark:border-sky-700 dark:text-sky-100"
                                  >
                                    {collapsed ? "＋ 開く" : "－ 閉じる"}
                                  </button>
                                  <span
                                    className="cursor-grab text-sky-500"
                                    {...dragProvided.dragHandleProps}
                                    title="ドラッグで並べ替え"
                                  >
                                    ☰
                                  </span>
                                  {items.length > 1 && (
                                    <button
                                      onClick={() => removeItem(idx)}
                                      className="text-xs text-rose-500 hover:underline"
                                    >
                                      削除
                                    </button>
                                  )}
                                </div>
                              </div>
                              {!collapsed && (
                                <div className="space-y-3 text-sm">
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <label className="flex flex-col gap-1">
                                      <span className="font-medium">候補ID</span>
                                      <input
                                        className="rounded-lg border border-sky-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-800 dark:bg-slate-950"
                                        value={item.id}
                                        onChange={(event) => updateItems(idx, { id: event.target.value })}
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                      <span className="font-medium">表示名</span>
                                      <input
                                        className="rounded-lg border border-sky-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-800 dark:bg-slate-950"
                                        value={item.name ?? ""}
                                        onChange={(event) => updateItems(idx, { name: event.target.value })}
                                      />
                                    </label>
                                  </div>
                                  <label className="flex flex-col gap-1">
                                    <span className="font-medium">補足メモ（任意）</span>
                                    <textarea
                                      className="min-h-[60px] rounded-lg border border-sky-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-800 dark:bg-slate-950"
                                      value={metaNote}
                                      onChange={(event) => updateItems(idx, { metaNote: event.target.value })}
                                    />
                                  </label>
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            <div className="rounded-2xl border border-emerald-400/50 bg-emerald-50/80 p-4 shadow-sm backdrop-blur dark:border-emerald-500/40 dark:bg-emerald-900/20">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-emerald-900 dark:text-emerald-100">評価指標</span>
                  <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">{metrics.length} 件</span>
                </div>
                <button
                  onClick={addMetric}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
                >
                  指標を追加
                </button>
              </div>

              <Droppable droppableId="metrics">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                    {metrics.map((metric, idx) => {
                      const collapsed = collapsedMetrics[idx];
                      const type = metric.type ?? "numeric";
                      const availableVars = Array.from(
                        new Set([
                          ...metrics
                            .slice(0, idx)
                            .map((m) => m.name)
                            .filter((name) => name.trim().length > 0),
                          "score",
                        ]),
                      );
                      const formulaError =
                        type === "formula" && metric.formula ? validateFormula(metric.formula, availableVars) : null;
                      const hasFormula = type === "formula";
                      const previewScope = hasFormula ? buildDummyScope(availableVars) : undefined;
                      let previewValue: number | undefined;
                      if (!formulaError && hasFormula && metric.formula && previewScope) {
                        try {
                          previewValue = Number(evalFormula(metric.formula, previewScope));
                        } catch {
                          previewValue = undefined;
                        }
                      }
                      return (
                        <Draggable key={`metric-${idx}-${metric.name}`} draggableId={`metric-${idx}-${metric.name}`} index={idx}>
                          {(dragProvided, snapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className={clsx(
                                "rounded-xl border border-emerald-400/50 bg-white/80 p-4 shadow-sm transition dark:bg-slate-950/60",
                                snapshot.isDragging ? "ring-2 ring-emerald-400" : undefined,
                              )}
                            >
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white"
                                  >
                                    {idx + 1}
                                  </span>
                                  <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">指標 {idx + 1}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => toggleMetricCollapse(idx)}
                                    className="rounded-md border border-emerald-200 px-2 py-1 text-xs text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-100"
                                  >
                                    {collapsed ? "＋ 開く" : "－ 閉じる"}
                                  </button>
                                  <span
                                    className="cursor-grab text-emerald-500"
                                    {...dragProvided.dragHandleProps}
                                    title="ドラッグで並べ替え"
                                  >
                                    ☰
                                  </span>
                                  {metrics.length > 1 && (
                                    <button
                                      onClick={() => removeMetric(idx)}
                                      className="text-xs text-rose-500 hover:underline"
                                    >
                                      削除
                                    </button>
                                  )}
                                </div>
                              </div>
                              {!collapsed && (
                                <div className="space-y-3 text-sm">
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <label className="flex flex-col gap-1">
                                      <span className="font-medium">指標名</span>
                                      <input
                                        className="rounded-lg border border-emerald-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-800 dark:bg-slate-950"
                                        value={metric.name}
                                        onChange={(event) => updateMetric(idx, { name: event.target.value })}
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                      <span className="flex items-center gap-1 font-medium">
                                        タイプ
                                        <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-700" title="数式を選ぶと下の式フィールドが表示されます。">
                                          ?
                                        </span>
                                      </span>
                                      <select
                                        className="rounded-lg border border-emerald-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-800 dark:bg-slate-950"
                                        value={type}
                                        onChange={(event) => updateMetric(idx, { type: event.target.value as MetricInput["type"] })}
                                      >
                                        <option value="numeric">数値</option>
                                        <option value="likert">リッカート</option>
                                        <option value="boolean">真偽</option>
                                        <option value="formula">数式</option>
                                      </select>
                                    </label>
                                  </div>

                                  {(type === "numeric" || type === "likert") && (
                                    <div className="grid gap-3 md:grid-cols-2">
                                      <label className="flex flex-col gap-1">
                                        <span className="font-medium">評価方向</span>
                                        <select
                                          className="rounded-lg border border-emerald-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-800 dark:bg-slate-950"
                                          value={metric.direction ?? "MAX"}
                                          onChange={(event) => updateMetric(idx, { direction: event.target.value as MetricInput["direction"] })}
                                        >
                                          <option value="MAX">大きいほど良い</option>
                                          <option value="MIN">小さいほど良い</option>
                                        </select>
                                      </label>
                                      <label className="flex flex-col gap-1">
                                        <span className="font-medium">正規化</span>
                                        <select
                                          className="rounded-lg border border-emerald-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-800 dark:bg-slate-950"
                                          value={metric.normalize ?? "none"}
                                          onChange={(event) => updateMetric(idx, { normalize: event.target.value as MetricInput["normalize"] })}
                                        >
                                          <option value="none">なし</option>
                                          <option value="minmax">Min-Max (0-1)</option>
                                          <option value="zscore">Z-Score</option>
                                        </select>
                                      </label>
                                    </div>
                                  )}

                                  <div className="grid gap-3 md:grid-cols-2">
                                    <label className="flex flex-col gap-1">
                                      <span className="font-medium">重み</span>
                                      <input
                                        type="number"
                                        step="0.1"
                                        className="rounded-lg border border-emerald-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-800 dark:bg-slate-950"
                                        value={metric.weight ?? 1}
                                        onChange={(event) => updateMetric(idx, { weight: Number(event.target.value) })}
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                      <span className="font-medium">目標値 / 備考</span>
                                      <input
                                        className="rounded-lg border border-emerald-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-800 dark:bg-slate-950"
                                        value={metric.target ?? ""}
                                        onChange={(event) =>
                                          updateMetric(idx, {
                                            target: event.target.value === "" ? undefined : event.target.value,
                                          })
                                        }
                                      />
                                    </label>
                                  </div>

                                  {hasFormula && (
                                    <div className="space-y-2 rounded-lg border border-emerald-200/70 bg-emerald-50/60 p-3 dark:border-emerald-700/70 dark:bg-emerald-900/30">
                                      <label className="flex flex-col gap-1">
                                        <span className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                                          計算式
                                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white" title="既存の指標名を変数として使用できます。例: 0.6*総合 + 0.4*評判">
                                            ヒント
                                          </span>
                                        </span>
                                        <input
                                          className="rounded-lg border border-emerald-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-950"
                                          value={metric.formula ?? ""}
                                          onChange={(event) => updateMetric(idx, { formula: event.target.value })}
                                          placeholder="0.6*総合 + 0.4*評判"
                                        />
                                      </label>
                                      <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <span className="font-medium text-emerald-900 dark:text-emerald-100">使用可能変数:</span>
                                        {availableVars.length === 0 ? (
                                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">指標名を先に設定してください</span>
                                        ) : (
                                          availableVars.map((name) => (
                                            <button
                                              key={name}
                                              type="button"
                                              onClick={() => updateMetric(idx, { formula: `${(metric.formula ?? "")}${metric.formula ? " + " : ""}${name}` })}
                                              className="rounded-full bg-emerald-200 px-2 py-0.5 font-semibold text-emerald-700 transition hover:bg-emerald-300"
                                            >
                                              {name}
                                            </button>
                                          ))
                                        )}
                                      </div>
                                      <div className="text-xs">
                                        {metric.formula ? (
                                          formulaError ? (
                                            <span className="text-rose-500">NG: {formulaError}</span>
                                          ) : (
                                            <span className="text-emerald-600">OK: 数式は有効です。</span>
                                          )
                                        ) : (
                                          <span className="text-text-muted">式を入力するとリアルタイム検証します。</span>
                                        )}
                                      </div>
                                      {previewValue !== undefined && Number.isFinite(previewValue) && (
                                        <div className="text-xs text-emerald-700">
                                          プレビュー例: {previewValue.toFixed(3)} （スコープ: {Object.entries(previewScope ?? {})
                                            .map(([key, value]) => `${key}=${value}`)
                                            .join(", ")}）
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm dark:border-slate-800">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={useWeb} onChange={(event) => setUseWeb(event.target.checked)} />
                Web検索を使用して根拠URLを取得
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={historyEnabled}
                  onChange={(event) => setHistoryEnabled(event.target.checked)}
                />
                履歴を保存
              </label>
              {historyEnabled && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
                  <div className="mb-2 font-medium">履歴用タイトル（任意）</div>
                  <input
                    className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-900"
                    value={historyTitle}
                    onChange={(event) => setHistoryTitle(event.target.value)}
                    placeholder="例：2024年7月 評価版"
                  />
                  <div className="space-y-2 text-xs text-text-muted">
                    <div>評価実行時に現在の条件と結果を自動保存します。</div>
                    <div>保存データには要約テキストと作成日時が含まれます。</div>
                  </div>
                </div>
              )}

              {history.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-medium">保存済みの履歴</div>
                    <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                      {history.length} 件
                    </span>
                  </div>
                  <ul className="space-y-3">
                    {history.map((entry) => (
                      <li key={entry.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{entry.title}</div>
                            <div className="text-xs text-text-muted">{new Date(entry.createdAt).toLocaleString()}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleLoadHistory(entry)}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs transition hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
                            >
                              反映
                            </button>
                            <button
                              onClick={() => handleDeleteHistory(entry.id)}
                              className="rounded-lg px-3 py-1.5 text-xs text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              削除
                            </button>
                          </div>
                        </div>
                        {entry.summaryText && (
                          <div className="mt-2 max-h-20 overflow-hidden text-ellipsis text-xs text-text-muted">
                            {entry.summaryText}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
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
                  { label: "要約タブ", value: "report" },
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

            <div ref={viewRef} className="min-h-[540px]">
              {result ? (
                <ResultTabs data={result} tab={tab} items={items} reportRef={reportRef} summary={summary} metrics={metrics} />
              ) : (
                <div className="grid h-full place-items-center rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-text-muted dark:border-slate-700">
                  AIに評価させるとここにティア表・ランキング・レポートが表示されます。
                </div>
              )}
            </div>
          </div>
        </div>
      </DragDropContext>

      <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 w-[min(960px,90vw)] -translate-x-1/2">
        <div className="pointer-events-auto flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">🚀 AIでスコアリング</div>
              <div className="text-xs text-text-muted">候補 {items.length} 件 / 指標 {metrics.length} 件</div>
            </div>
            <button
              onClick={run}
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:from-sky-600 hover:to-emerald-600 disabled:opacity-60"
            >
              {loading ? "評価を実行中…" : "AIでスコアリング"}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {loading ? (
              <span className="flex items-center gap-2 text-sky-600">
                <span className="h-2 w-2 animate-ping rounded-full bg-sky-500" />
                処理中… AIの評価を待機しています。
              </span>
            ) : error ? (
              <span className="text-rose-500">{error}</span>
            ) : (
              <span className="text-text-muted">設定を調整してから実行ボタンを押してください。</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
