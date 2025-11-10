"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "react-beautiful-dnd";
import clsx from "clsx";
import Segmented from "@/components/Segmented";
import ResultTabs, { type ViewTab } from "@/components/ResultTabs";
import type {
  AgentResult,
  Criterion,
  ItemInput,
  MetricInput,
  MetricType,
  ScoreRequest,
  ScoreResponse,
} from "@/lib/types";
import {
  exportCSV,
  exportJSON,
  exportPNG,
  exportReportDocx,
  exportReportPDF,
} from "@/lib/export";
import { buildReportSummary } from "@/lib/report";
import { evalFormula, validateFormula } from "@/lib/formula";
import { buildRankingUrl } from "@/lib/share";

const HISTORY_KEY = "tier-rank-history";
type PublishVisibility = "PUBLIC" | "UNLISTED" | "PRIVATE";

const DEFAULT_ITEMS: ItemInput[] = [
  { id: "A", name: "案A" },
  { id: "B", name: "案B" },
  { id: "C", name: "案C" },
];

const SIMPLE_METRICS: MetricInput[] = [
  { name: "総合", type: "numeric", direction: "MAX", weight: 1, normalize: "none" },
];

const DEFAULT_TIER_LABELS = ["S", "A", "B", "C", "D"];
const METRIC_TYPES: MetricType[] = ["numeric", "likert", "boolean", "formula"];

const NAMING_PRESET: { items: ItemInput[]; metrics: MetricInput[] } = {
  items: [
    { id: "A", name: "案A", meta: { note: "語感が良く覚えやすい" } },
    { id: "B", name: "案B", meta: { note: "既存ブランドに似た名称" } },
    { id: "C", name: "案C", meta: { note: "業界用語を活かした案" } },
  ],
  metrics: [
    { name: "覚えやすさ", type: "numeric", direction: "MAX", weight: 3, normalize: "none" },
    { name: "独自性", type: "numeric", direction: "MAX", weight: 2, normalize: "none" },
    { name: "業界との親和性", type: "numeric", direction: "MAX", weight: 4, normalize: "none" },
  ],
};

const COMPANY_PRESET: { items: ItemInput[]; metrics: MetricInput[] } = {
  items: [
    { id: "A", name: "企業A", meta: { note: "創業10年のスタートアップ" } },
    { id: "B", name: "企業B", meta: { note: "福利厚生が充実した大手" } },
  ],
  metrics: [
    { name: "労働環境", type: "numeric", direction: "MAX", weight: 4, normalize: "none" },
    { name: "給与水準", type: "numeric", direction: "MAX", weight: 3, normalize: "none" },
    { name: "将来性", type: "numeric", direction: "MAX", weight: 5, normalize: "none" },
  ],
};

type HistoryEntry = {
  id: string;
  title: string;
  createdAt: number;
  payload: ScoreRequest;
  itemsSnapshot?: ItemInput[];
  metricsSnapshot?: MetricInput[];
  result?: AgentResult;
  scoreResponse?: ScoreResponse;
  summaryText?: string;
};

type ScoreFormProps = {
  projectSlug?: string;
  searchProjectSlug?: string;
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

function convertScoreResponseToAgentResult(response: ScoreResponse | undefined): AgentResult | undefined {
  if (!response) return undefined;
  return {
    items: response.scores.map((entry) => ({
      id: entry.id,
      score: entry.score,
      tier: entry.tier,
      reason: entry.reasons,
    })),
  };
}

function normalizeMetricType(value: string | undefined | null): MetricType {
  if (value && METRIC_TYPES.includes(value as MetricType)) {
    return value as MetricType;
  }
  return "numeric";
}

type AgentResultItem = NonNullable<AgentResult["items"]>[number];

function isScoreResponseEntry(
  entry: ScoreResponse["scores"][number] | AgentResultItem,
): entry is ScoreResponse["scores"][number] {
  return "name" in entry;
}

export default function ScoreForm({
  projectSlug: initialProjectSlug,
  searchProjectSlug,
}: ScoreFormProps = {}) {
  const { data: session } = useSession();
  const resolvedProjectSlug = searchProjectSlug ?? initialProjectSlug;
  const [items, setItems] = useState<ItemInput[]>(() => DEFAULT_ITEMS.map((item) => ({ ...item })));
  const [metrics, setMetrics] = useState<MetricInput[]>(() => SIMPLE_METRICS.map((metric) => ({ ...metric })));
  const [useWeb, setUseWeb] = useState(false);
  const [historyEnabled, setHistoryEnabled] = useState(false);
  const [historyTitle, setHistoryTitle] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentResult | undefined>();
  const [scoreResponse, setScoreResponse] = useState<ScoreResponse | undefined>();
  const [tab, setTab] = useState<ViewTab>("tier");
  const [collapsedItems, setCollapsedItems] = useState<Record<string, boolean>>({});
  const [collapsedMetrics, setCollapsedMetrics] = useState<Record<string, boolean>>({});
  const [limitState, setLimitState] = useState<{
    scoreRemaining?: number;
    scoreReset?: string;
    webRemaining?: number;
    webReset?: string;
  }>({});
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishStatus, setPublishStatus] = useState<"idle" | "loading" | "success">("idle");
  const [publishError, setPublishError] = useState<string | undefined>();
  const [publishedSlug, setPublishedSlug] = useState<string | undefined>();
  const [publishTitle, setPublishTitle] = useState("");
  const [publishCategory, setPublishCategory] = useState("");
  const [publishTags, setPublishTags] = useState("");
  const [publishSummary, setPublishSummary] = useState("");
  const [publishVisibility, setPublishVisibility] = useState<PublishVisibility>("PUBLIC");

  const viewRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const isLoggedIn = Boolean(session?.user);
  const maxScorePerDay = isLoggedIn ? 50 : 5;
  const maxWebPerDay = isLoggedIn ? 10 : 2;
  const effectiveScoreRemaining = limitState.scoreRemaining ?? maxScorePerDay;
  const effectiveWebRemaining = limitState.webRemaining ?? maxWebPerDay;
  const disableRunButton =
    loading ||
    (limitState.scoreRemaining !== undefined && limitState.scoreRemaining <= 0) ||
    (useWeb && limitState.webRemaining !== undefined && limitState.webRemaining <= 0);
  const projectSlugMissing = !resolvedProjectSlug;
  const disableRun = disableRunButton || projectSlugMissing;
  const publishDisabled = publishStatus === "loading";
  const publishedUrl = publishedSlug ? buildRankingUrl(publishedSlug) : undefined;

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
    setItems((prev) => [...prev, { id: candidate, name: `案${candidate}` }]);
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

  function applyPreset(kind: "reset" | "naming" | "company") {
    if (kind === "reset") {
      setItems(DEFAULT_ITEMS.map((item) => ({ ...item })));
      setMetrics(SIMPLE_METRICS.map((metric) => ({ ...metric })));
      return;
    }
    if (kind === "naming") {
      setItems(NAMING_PRESET.items.map((item) => ({ ...item })));
      setMetrics(NAMING_PRESET.metrics.map((metric) => ({ ...metric })));
      return;
    }
    setItems(COMPANY_PRESET.items.map((item) => ({ ...item })));
    setMetrics(COMPANY_PRESET.metrics.map((metric) => ({ ...metric })));
  }

  function validate():
    | {
        request: ScoreRequest;
        cleanedItems: ItemInput[];
        cleanedMetrics: MetricInput[];
      }
    | undefined {
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
    const candidates = cleanedItems.map((item) => ({
      id: item.id,
      name: item.name,
      description: typeof item.meta?.note === "string" ? item.meta.note : undefined,
    }));

    const normalizedCriteria: Criterion[] = cleanedMetrics.map((metric, index) => {
      const parsedWeight = Number(metric.weight ?? 1);
      const weight = Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 1;
      return {
        key: metric.name || `metric-${index + 1}`,
        label: metric.name,
        direction: metric.direction === "MIN" ? "down" : "up",
        weight,
        type: normalizeMetricType(metric.type),
        note: metric.description,
      };
    });

    const request: ScoreRequest = {
      candidates,
      criteria: normalizedCriteria,
      options: {
        tiers: DEFAULT_TIER_LABELS,
      },
    };

    return {
      request,
      cleanedItems,
      cleanedMetrics,
    };
  }

  async function run() {
    const validation = validate();
    if (!validation) return;
    const { request: payload, cleanedItems, cleanedMetrics } = validation;
    if (disableRun) {
      if (projectSlugMissing) {
        setError("AIプロジェクトが設定されていません。管理者にお問い合わせください。");
        return;
      }
      setError("本日の利用上限に達しました。");
      return;
    }
    setLoading(true);
    setError(undefined);
    setPublishStatus("idle");
    setPublishError(undefined);
    setPublishedSlug(undefined);
    try {
      const activeSlug = (searchParams.get("project")?.trim() || undefined) ?? initialProjectSlug;
      if (!activeSlug) {
        setError("AIプロジェクトが設定されていません。管理者にお問い合わせください。");
        setScoreResponse(undefined);
        setResult(undefined);
        return;
      }
      const response = await fetch(`/api/projects/${encodeURIComponent(activeSlug)}/agent/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ScoreRequest payload expects candidates, criteria, and optional tier labels.
        body: JSON.stringify(payload),
      });
      const scoreRemainingHeader = response.headers.get("x-ratelimit-score-remaining");
      const scoreResetHeader = response.headers.get("x-ratelimit-score-reset");
      const webRemainingHeader = response.headers.get("x-ratelimit-web-remaining");
      const webResetHeader = response.headers.get("x-ratelimit-web-reset");
      setLimitState((prev) => {
        const next = { ...prev };
        if (scoreRemainingHeader !== null) {
          const parsedRemaining = Number(scoreRemainingHeader);
          if (!Number.isNaN(parsedRemaining)) next.scoreRemaining = parsedRemaining;
        }
        if (scoreResetHeader) {
          next.scoreReset = scoreResetHeader;
        }
        if (webRemainingHeader !== null) {
          const parsedRemaining = Number(webRemainingHeader);
          if (!Number.isNaN(parsedRemaining)) next.webRemaining = parsedRemaining;
        }
        if (webResetHeader) {
          next.webReset = webResetHeader;
        }
        return next;
      });

      const json = await response.json().catch(() => undefined);

      if (!response.ok || !json) {
        if (response.status === 429 && json && json.error === "limit_exceeded") {
          if (json.kind === "web") {
            setError("Web検索の利用上限に達しました。明日までお待ちください。");
          } else {
            setError("AIスコアリングの利用上限に達しました。明日までお待ちください。");
          }
        } else {
          const code = json && typeof json.error === "string" ? json.error : undefined;
          setError(resolveAgentErrorMessage(code, response.status));
        }
        setResult(undefined);
        setScoreResponse(undefined);
        return;
      }

      if (json && typeof json === "object" && "error" in json && typeof json.error === "string") {
        setError(resolveAgentErrorMessage(json.error, response.status));
        setResult(undefined);
        setScoreResponse(undefined);
        return;
      }

      if (!json || !Array.isArray((json as ScoreResponse).tiers) || !Array.isArray((json as ScoreResponse).scores)) {
        setError("AIがスコアを返しませんでした。入力内容を見直して再度お試しください。");
        setResult(undefined);
        setScoreResponse(undefined);
        return;
      }

      // Successful responses follow ScoreResponse: { tiers: TierResult[], scores: ScoreEntry[] }.
      const structured = json as ScoreResponse;
      const converted = convertScoreResponseToAgentResult(structured);
      setScoreResponse(structured);
      setResult(converted);
      setTab((prev) => (prev === "json" || prev === "report" ? prev : "tier"));
      if (historyEnabled) {
        const entry: HistoryEntry = {
          id: createHistoryId(),
          title: historyTitle.trim() || `保存済み ${new Date().toLocaleString()}`,
          createdAt: Date.now(),
          payload,
          itemsSnapshot: cleanedItems,
          metricsSnapshot: cleanedMetrics,
          result: converted,
          scoreResponse: structured,
          summaryText: buildReportSummary(converted, cleanedItems, cleanedMetrics)?.plainText,
        };
        persistHistory([entry, ...history]);
      }
    } catch {
      setError("API呼び出しに失敗しました。");
      setScoreResponse(undefined);
      setResult(undefined);
    } finally {
      setLoading(false);
    }
  }

  function resolveAgentErrorMessage(code?: string, status?: number) {
    if (!code) {
      if (status === 404) {
        return "指定されたプロジェクトが見つかりません。URLをご確認ください。";
      }
      return "AIがスコアを返しませんでした。時間をおいて再試行してください。";
    }
    const messages: Record<string, string> = {
      invalid_request: "候補と評価指標の入力内容を確認してください。",
      invalid_json: "リクエスト形式が正しくありません。ページを再読み込みして再試行してください。",
      no_items: "AIが評価結果を返しませんでした。候補の情報を見直して再実行してください。",
      NETWORK_ERROR: "AIサービスへの接続に失敗しました。時間をおいて再試行してください。",
      UPSTREAM_ERROR: "AIサービス側でエラーが発生しました。しばらく待ってから再試行してください。",
      EMPTY_RESPONSE: "AIが結果を返しませんでした。入力内容を調整して再実行してください。",
      PARSE_ERROR: "AIのレスポンスを解析できませんでした。少し時間をおいて再試行してください。",
      "Candidates and criteria are required": "候補と評価軸を入力してください。",
      "Invalid request payload": "候補と評価軸の入力内容を確認してください。",
      "Invalid JSON body": "リクエスト形式が正しくありません。ページを再読み込みして再試行してください。",
      "OPENAI_API_KEY is not set": "環境変数 OPENAI_API_KEY を設定してください。",
      "Project slug is required": "プロジェクトIDを指定してください。",
      "Project not found": "指定されたプロジェクトが見つかりません。",
      "Failed to call OpenAI": "AIサービスへの接続に失敗しました。時間をおいて再試行してください。",
      "OpenAI response error": "AIサービス側でエラーが発生しました。しばらく待ってから再試行してください。",
      "Failed to parse OpenAI response": "AIのレスポンスを解析できませんでした。少し時間をおいて再試行してください。",
      "Empty response from OpenAI": "AIが結果を返しませんでした。入力内容を調整して再実行してください。",
      "Internal Server Error": "AIサービス内で予期せぬエラーが発生しました。時間をおいて再試行してください。",
      "AIプロジェクトが設定されていません。管理者にお問い合わせください。": "AIプロジェクトが設定されていません。管理者にお問い合わせください。",
    };
    if (code.startsWith("Project not found")) {
      return "指定されたプロジェクトが見つかりません。URLをご確認ください。";
    }
    return messages[code] ?? code;
  }

  function exportAsCSV() {
    const entries = scoreResponse?.scores ?? result?.items;
    if (!entries || entries.length === 0) return;
    const rows = (entries as (ScoreResponse["scores"][number] | AgentResultItem)[]).map((item) => {
      if (isScoreResponseEntry(item)) {
        return {
          id: item.id,
          name: item.name,
          tier: item.tier,
          score: item.score,
          reason: item.reasons,
        };
      }
      const fallbackName = items.find((candidate) => candidate.id === item.id)?.name ?? item.id;
      return {
        id: item.id,
        name: fallbackName,
        tier: item.tier ?? "",
        score: item.score ?? 0,
        reason: item.reason,
      };
    });
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
    const fallbackItems = (entry as any).payload?.items ?? [];
    const fallbackMetrics = (entry as any).payload?.metrics ?? [];
    const nextItems: ItemInput[] = (entry.itemsSnapshot?.length ? entry.itemsSnapshot : fallbackItems).map((item: ItemInput) => ({
      ...item,
    }));
    const nextMetrics: MetricInput[] = (entry.metricsSnapshot?.length ? entry.metricsSnapshot : fallbackMetrics).map(
      (metric: MetricInput) => ({ ...metric }),
    );
    setItems(nextItems);
    setMetrics(nextMetrics);
    setScoreResponse(entry.scoreResponse);
    setResult(entry.result ?? convertScoreResponseToAgentResult(entry.scoreResponse));
    setTab("tier");
  }

  function handleDeleteHistory(entryId: string) {
    const next = history.filter((entry) => entry.id !== entryId);
    persistHistory(next);
  }

  async function handlePublishSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoggedIn) {
      setPublishError("公開するにはログインが必要です。");
      return;
    }
    if (!result) {
      setPublishError("公開前にAIでスコアリングを実行してください。");
      return;
    }
    if (!publishTitle.trim()) {
      setPublishError("タイトルを入力してください。");
      return;
    }
    setPublishStatus("loading");
    setPublishError(undefined);
    try {
      const response = await fetch("/api/rankings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: publishTitle.trim(),
          summary: publishSummary.trim() || undefined,
          category: publishCategory.trim() || undefined,
          tags: publishTags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0),
          visibility: publishVisibility,
          items,
          metrics,
          result,
          thumbUrl: undefined,
        }),
      });
      const json = await response.json().catch(() => undefined);
      if (!response.ok || !json) {
        setPublishStatus("idle");
        setPublishError(json && typeof json.error === "string" ? json.error : "公開処理に失敗しました。");
        return;
      }
      setPublishStatus("success");
      setPublishError(undefined);
      setPublishedSlug(json.slug);
    } catch (publishErr) {
      console.error(publishErr);
      setPublishStatus("idle");
      setPublishError("公開処理に失敗しました。");
    }
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
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">サンプルプリセット</h2>
                  <p className="mt-1 text-sm text-text-muted">
                    入力例を読み込みたいときは以下のサンプルを利用してください。どれかを選ぶと候補と評価軸がまとめてセットされます。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <button
                    onClick={() => applyPreset("reset")}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    初期セットに戻す
                  </button>
                  <button
                    onClick={() => applyPreset("naming")}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    命名案の比較（サンプル）
                  </button>
                  <button
                    onClick={() => applyPreset("company")}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    企業比較（サンプル）
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-sky-400/50 bg-sky-50/80 p-4 shadow-sm backdrop-blur dark:border-sky-500/40 dark:bg-sky-900/20">
              <div className="mb-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Step 1</div>
                    <div className="text-base font-semibold text-sky-900 dark:text-sky-100">候補を入力する</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-sky-600 px-2 py-0.5 text-xs font-semibold text-white">{items.length} 件</span>
                    <button
                      onClick={addItem}
                      className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700"
                    >
                      候補を追加
                    </button>
                  </div>
                </div>
                <p className="text-xs text-sky-900/80 dark:text-sky-100/80">
                  ランキングしたい対象を追加してください（例：プランA / プランB、企業A / 企業B、名前案など）。
                </p>
                <div className="rounded-xl border border-sky-200/70 bg-white/80 p-3 text-[11px] leading-5 text-sky-900/80 shadow-sm dark:border-sky-700/70 dark:bg-slate-950/40 dark:text-sky-100/80">
                  <div><span className="font-semibold">候補ID</span>：システム用の短い識別子。例：A、plan_basic など。</div>
                  <div><span className="font-semibold">表示名</span>：ユーザーに見せる名称。例：案A、PS5。</div>
                  <div><span className="font-semibold">補足メモ</span>：比較時の参考メモ。例：月額980円の入門プラン。</div>
                </div>
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
                                      <span className="text-xs text-sky-800/80 dark:text-sky-100/70">AIが識別する短いID（例：A）</span>
                                      <input
                                        className="rounded-lg border border-sky-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-800 dark:bg-slate-950"
                                        value={item.id}
                                        onChange={(event) => updateItems(idx, { id: event.target.value })}
                                        placeholder="例: A"
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                      <span className="font-medium">表示名</span>
                                      <span className="text-xs text-sky-800/80 dark:text-sky-100/70">一般ユーザー向けの名前（例：プランA）</span>
                                      <input
                                        className="rounded-lg border border-sky-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-800 dark:bg-slate-950"
                                        value={item.name ?? ""}
                                        onChange={(event) => updateItems(idx, { name: event.target.value })}
                                        placeholder="例: プランA"
                                      />
                                    </label>
                                  </div>
                                  <label className="flex flex-col gap-1">
                                    <span className="font-medium">補足メモ（任意）</span>
                                    <span className="text-xs text-sky-800/80 dark:text-sky-100/70">比較時の参考情報をメモできます</span>
                                    <textarea
                                      className="min-h-[60px] rounded-lg border border-sky-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-800 dark:bg-slate-950"
                                      value={metaNote}
                                      onChange={(event) => updateItems(idx, { metaNote: event.target.value })}
                                      placeholder="例: 月額980円の入門プラン"
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
              <div className="mb-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Step 2</div>
                    <div className="text-base font-semibold text-emerald-900 dark:text-emerald-100">評価軸を設定する</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">{metrics.length} 件</span>
                    <button
                      onClick={addMetric}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
                    >
                      指標を追加
                    </button>
                  </div>
                </div>
                <p className="text-xs text-emerald-900/80 dark:text-emerald-100/80">
                  比較に使う観点を追加してください。AIはこの情報をもとに総合スコアとティアを提案します。
                </p>
                <div className="rounded-xl border border-emerald-200/70 bg-white/80 p-3 text-[11px] leading-5 text-emerald-900/80 shadow-sm dark:border-emerald-700/70 dark:bg-emerald-950/40 dark:text-emerald-100/80">
                  <div><span className="font-semibold">指標名</span>：例：コスパ / 信頼性 / デザイン。</div>
                  <div><span className="font-semibold">タイプ</span>：数値（1〜10など）/ 選択式 / Yes/No。迷ったら数値を選べばOK。</div>
                  <div><span className="font-semibold">評価方向</span>：高いほど良い or 低いほど良い。</div>
                  <div><span className="font-semibold">正規化</span>：不明な場合は「なし」で構いません。</div>
                  <div><span className="font-semibold">重み</span>：重要度（例：1〜5）。大きいほど重視されます。</div>
                  <div><span className="font-semibold">閾値 / 備考</span>：除外条件やメモ（例：信頼性は3未満なら除外）。</div>
                </div>
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
                                      <span className="text-xs text-emerald-800/80 dark:text-emerald-100/70">例：コスパ / 信頼性 / デザイン</span>
                                      <input
                                        className="rounded-lg border border-emerald-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-800 dark:bg-slate-950"
                                        value={metric.name}
                                        onChange={(event) => updateMetric(idx, { name: event.target.value })}
                                        placeholder="例: コスパ"
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                      <span className="flex items-center gap-1 font-medium">
                                        タイプ
                                        <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-700" title="数式を選ぶと下の式フィールドが表示されます。">
                                          ?
                                        </span>
                                      </span>
                                      <span className="text-xs text-emerald-800/80 dark:text-emerald-100/70">数値（1〜10など）/ 選択式 / Yes/No。迷ったら数値でOKです。</span>
                                      <select
                                        className="rounded-lg border border-emerald-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-800 dark:bg-slate-950"
                                        value={type}
                                        onChange={(event) => updateMetric(idx, { type: event.target.value as MetricInput["type"] })}
                                      >
                                        <option value="numeric">数値（1〜10など）</option>
                                        <option value="likert">選択式（S/A/B/C 等）</option>
                                        <option value="boolean">Yes/No（真偽）</option>
                                        <option value="formula">数式（他指標から算出）</option>
                                      </select>
                                    </label>
                                  </div>

                                  {(type === "numeric" || type === "likert") && (
                                    <div className="grid gap-3 md:grid-cols-2">
                                      <label className="flex flex-col gap-1">
                                        <span className="font-medium">評価方向</span>
                                        <span className="text-xs text-emerald-800/80 dark:text-emerald-100/70">高いほうが良いか、低いほうが良いかを選びます</span>
                                        <select
                                          className="rounded-lg border border-emerald-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-800 dark:bg-slate-950"
                                          value={metric.direction ?? "MAX"}
                                          onChange={(event) => updateMetric(idx, { direction: event.target.value as MetricInput["direction"] })}
                                        >
                                          <option value="MAX">高いほど良い</option>
                                          <option value="MIN">低いほど良い</option>
                                        </select>
                                      </label>
                                      <label className="flex flex-col gap-1">
                                        <span className="font-medium">正規化</span>
                                        <span className="text-xs text-emerald-800/80 dark:text-emerald-100/70">分からなければ「なし」のままで大丈夫です</span>
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
                                      <span className="text-xs text-emerald-800/80 dark:text-emerald-100/70">重要度を数値で入力（例：1〜5）</span>
                                      <input
                                        type="number"
                                        step="0.1"
                                        className="rounded-lg border border-emerald-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-800 dark:bg-slate-950"
                                        value={metric.weight ?? 1}
                                        onChange={(event) => updateMetric(idx, { weight: Number(event.target.value) })}
                                        placeholder="例: 3"
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                      <span className="font-medium">閾値 / 備考</span>
                                      <span className="text-xs text-emerald-800/80 dark:text-emerald-100/70">除外条件や注記（例：信頼性は3未満なら除外）</span>
                                      <input
                                        className="rounded-lg border border-emerald-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-800 dark:bg-slate-950"
                                        value={metric.target ?? ""}
                                        onChange={(event) =>
                                          updateMetric(idx, {
                                            target: event.target.value === "" ? undefined : event.target.value,
                                          })
                                        }
                                        placeholder="例: 信頼性は3未満なら除外"
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
                  { label: "要約", value: "report" },
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
                <ResultTabs
                  data={result}
                  tab={tab}
                  items={items}
                  reportRef={reportRef}
                  summary={summary}
                  metrics={metrics}
                  scoreResponse={scoreResponse}
                />
              ) : (
                <div className="flex h-full flex-col justify-center gap-4 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-text-muted dark:border-slate-700">
                  <div>
                    <div className="text-base font-semibold text-slate-700 dark:text-slate-200">まだ評価は実行されていません。</div>
                    <p className="mt-1">以下のステップに沿って候補と評価軸を準備してください。</p>
                  </div>
                  <ol className="list-decimal space-y-1 pl-5 text-left">
                    <li>左側で候補（案A、案B など）を登録する</li>
                    <li>評価軸（例：コスパ、信頼性）を追加する</li>
                    <li>画面下部の「AIに評価を依頼する」を押す</li>
                  </ol>
                  <p className="text-xs text-text-muted">
                    実行するとティア表・ランキング・要約レポート・JSONをここに表示します。
                  </p>
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
              <div className="text-sm font-semibold">🚀 AI評価を実行</div>
              <div className="text-xs text-text-muted">候補 {items.length} 件 / 指標 {metrics.length} 件</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-700 dark:bg-slate-700/60 dark:text-slate-100">
                  AI {Math.max(0, effectiveScoreRemaining)} / {maxScorePerDay}
                </span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-700 dark:bg-slate-700/60 dark:text-slate-100">
                  Web {Math.max(0, effectiveWebRemaining)} / {maxWebPerDay}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPublishOpen(true);
                  setPublishError(undefined);
                }}
                disabled={publishDisabled}
                className="rounded-xl border border-emerald-300 bg-white/80 px-4 py-2 text-sm font-semibold text-emerald-600 shadow-sm transition hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
              >
                公開設定
              </button>
              <button
                onClick={run}
                disabled={disableRun}
                className="rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:from-sky-600 hover:to-emerald-600 disabled:opacity-60"
              >
                {loading ? "AIが評価しています…" : "AIに評価を依頼する"}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {projectSlugMissing && !loading && !error ? (
              <span className="text-rose-500">AIプロジェクトが設定されていません。管理者にお問い合わせください。</span>
            ) : loading ? (
              <span className="flex items-center gap-2 text-sky-600">
                <span className="h-2 w-2 animate-ping rounded-full bg-sky-500" />
                処理中… AIの結果を待機しています。
              </span>
            ) : error ? (
              <span className="text-rose-500">{error}</span>
            ) : (
              <span className="text-text-muted">左側のステップを埋めたら「AIに評価を依頼する」を押してください。</span>
            )}
          </div>
          {(publishStatus === "success" && publishedUrl) || publishError ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100">
              {publishStatus === "success" && publishedUrl ? (
                <span>
                  公開が完了しました。<a className="underline" href={publishedUrl} target="_blank" rel="noreferrer">公開ページを開く</a>
                </span>
              ) : publishError ? (
                <span className="text-rose-500">{publishError}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {publishOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur">
          <div className="w-[min(520px,92vw)] rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">ランキングを公開</h3>
                <p className="text-sm text-text-muted">タイトルやタグを設定して公開ビューを作成します。</p>
              </div>
              <button
                type="button"
                onClick={() => setPublishOpen(false)}
                className="rounded-full border border-slate-200 px-2 py-1 text-sm text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>
            <form className="space-y-4" onSubmit={handlePublishSubmit}>
              <div className="grid gap-4">
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-semibold">タイトル</span>
                  <input
                    value={publishTitle}
                    onChange={(event) => setPublishTitle(event.target.value)}
                    placeholder="例：2024年 上半期ノートPCランキング"
                    className="rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-semibold">カテゴリ</span>
                  <input
                    value={publishCategory}
                    onChange={(event) => setPublishCategory(event.target.value)}
                    placeholder="例：ガジェット"
                    className="rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-semibold">タグ</span>
                  <input
                    value={publishTags}
                    onChange={(event) => setPublishTags(event.target.value)}
                    placeholder="カンマ区切りで入力 (例：ノートPC, 2024)"
                    className="rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-semibold">紹介文</span>
                  <textarea
                    value={publishSummary}
                    onChange={(event) => setPublishSummary(event.target.value)}
                    rows={4}
                    placeholder="ランキングの背景やポイントを短く紹介しましょう。"
                    className="rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-900"
                  />
                  <span className="text-xs text-text-muted">Markdown記法に対応し、安全なHTMLに自動変換されます。</span>
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-semibold">公開範囲</span>
                  <select
                    value={publishVisibility}
                    onChange={(event) => setPublishVisibility(event.target.value as PublishVisibility)}
                    className="rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="PUBLIC">公開（誰でも閲覧可能）</option>
                    <option value="UNLISTED">限定公開（リンクを知っている人のみ）</option>
                    <option value="PRIVATE">非公開（自分のみ）</option>
                  </select>
                </label>
              </div>
              <div className="space-y-2 text-xs text-text-muted">
                {!isLoggedIn && <p className="text-rose-500">公開するにはGoogleでログインしてください。</p>}
                {isLoggedIn && !result && <p className="text-amber-600">公開前にAIスコアリングを実行してください。</p>}
                <p>公開後は /r/[slug] に閲覧専用ビューが生成され、いいね・ブックマーク・共有リンクが利用できます。</p>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPublishOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={publishStatus === "loading" || !isLoggedIn || !result}
                  className="rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:from-emerald-600 hover:to-sky-600 disabled:opacity-60"
                >
                  {publishStatus === "loading" ? "公開中…" : "公開する"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
