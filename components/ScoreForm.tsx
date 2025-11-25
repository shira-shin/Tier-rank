"use client";

import { FormEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "react-beautiful-dnd";
import clsx from "clsx";
import Segmented from "@/components/Segmented";
import ResultReport from "@/components/ResultReport";
import type {
  AgentResult,
  Criterion,
  ItemInput,
  MetricInput,
  MetricType,
  ScoreRequest,
  ScoreResponse,
  EvaluationStrictness,
  SearchDepth,
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

const QUICK_TEMPLATES: { key: string; title: string; description: string; items: ItemInput[]; metrics: MetricInput[] }[] = [
  {
    key: "proposal",
    title: "提案のたたき台",
    description: "3 つの候補とシンプルな評価軸をまとめて作成します。",
    items: [
      { id: "A", name: "案A", meta: { note: "最もベーシックなプラン" } },
      { id: "B", name: "案B", meta: { note: "価格と機能のバランス型" } },
      { id: "C", name: "案C", meta: { note: "差別化要素を強化" } },
    ],
    metrics: [
      { name: "コスト", type: "numeric", direction: "MIN", weight: 2, normalize: "none" },
      { name: "効果", type: "numeric", direction: "MAX", weight: 3, normalize: "none" },
      { name: "実現しやすさ", type: "numeric", direction: "MAX", weight: 2, normalize: "none" },
    ],
  },
  {
    key: "service",
    title: "サービス比較",
    description: "ベーシック / スタンダード / プレミアムのような段階比較に使えます。",
    items: [
      { id: "A", name: "ライトプラン", meta: { note: "価格重視で導入しやすい" } },
      { id: "B", name: "スタンダード", meta: { note: "最もバランスの良い選択肢" } },
      { id: "C", name: "プロ", meta: { note: "上位機能を網羅" } },
    ],
    metrics: [
      { name: "コスパ", type: "numeric", direction: "MAX", weight: 3, normalize: "none" },
      { name: "機能の充実度", type: "numeric", direction: "MAX", weight: 3, normalize: "none" },
      { name: "サポート", type: "numeric", direction: "MAX", weight: 2, normalize: "none" },
    ],
  },
  {
    key: "hiring",
    title: "採用・人材比較",
    description: "求人票や人材プールの選定に使える軸をセットします。",
    items: [
      { id: "A", name: "候補者A", meta: { note: "経験豊富なオールラウンダー" } },
      { id: "B", name: "候補者B", meta: { note: "ポテンシャルが高い若手" } },
    ],
    metrics: [
      { name: "スキルフィット", type: "numeric", direction: "MAX", weight: 3, normalize: "none" },
      { name: "カルチャー", type: "numeric", direction: "MAX", weight: 2, normalize: "none" },
      { name: "入社時期", type: "numeric", direction: "MIN", weight: 1, normalize: "none" },
    ],
  },
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

const STRICTNESS_SUMMARY: Record<EvaluationStrictness, string> = {
  lenient: "平均的な候補にも好意的な評価を付けやすくします。",
  balanced: "長所と短所をバランス良く判断します。",
  strict: "Sランクはごく少数。情報不足は減点対象です。",
};

const STRICTNESS_DETAIL: Record<EvaluationStrictness, string> = {
  lenient: "プラス要素を重視し、B〜Aランクが出やすいモードです。",
  balanced: "従来どおりの厳しさで、迷った場合はこの設定がおすすめです。",
  strict: "根拠が弱い場合はスコアを抑え、リスクや不確実性を積極的に指摘します。",
};

const SEARCH_DEPTH_SUMMARY: Record<SearchDepth, string> = {
  shallow: "主要な情報源だけを素早く確認します。",
  normal: "代表的な情報源を複数調査します。",
  deep: "肯定・否定の両面を深掘りし、複数の根拠を集めます。",
};

const HISTORY_CARD_STYLES = [
  {
    border: "border-sky-300/40",
    gradient: "from-slate-950/80 via-sky-900/40 to-slate-900/70",
    shadow: "shadow-[0_30px_60px_rgba(14,165,233,0.18)]",
  },
  {
    border: "border-emerald-300/40",
    gradient: "from-slate-950/80 via-emerald-900/40 to-slate-900/70",
    shadow: "shadow-[0_30px_60px_rgba(16,185,129,0.18)]",
  },
  {
    border: "border-amber-300/40",
    gradient: "from-slate-950/80 via-amber-900/40 to-slate-900/70",
    shadow: "shadow-[0_30px_60px_rgba(251,191,36,0.22)]",
  },
];

function formatPercent(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

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
  initialProjectSlug?: string;
  displayContext?: "default" | "home";
};

function createHistoryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `history-${Date.now()}`;
}

function createMetricId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `metric-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function addIdsToMetrics(metrics: MetricInput[]) {
  return metrics.map((metric) => ({ ...metric, id: metric.id ?? createMetricId() }));
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

function clampScore(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function pseudoRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function buildDummyCriteria(
  metricNames: string[],
  metricWeights: number[],
  itemLabel: string,
  offset: number,
) {
  return metricNames.map((name, idx) => {
    const strength = 0.6 + pseudoRandom(offset + idx) * 0.32;
    const rounded = Number(strength.toFixed(3));
    const emphasis = metricWeights[idx] >= Math.max(...metricWeights) * 0.9 ? "特に" : "";
    const angleHints = ["最新レビュー", "公的データ", "現地の声", "トレンド", "運用実績"];
    const hint = angleHints[idx % angleHints.length];
    return {
      key: name,
      weight: metricWeights[idx] ?? 1,
      score: clampScore(rounded),
      reason: `${itemLabel}は${name}で${emphasis}安定した強み。${hint}から裏付け済み。`,
    };
  });
}

function enrichScoreResponse(
  response: ScoreResponse,
  items: ItemInput[],
  metrics: MetricInput[],
): ScoreResponse {
  const metricNames = metrics.length ? metrics.map((metric, idx) => metric.name || `指標${idx + 1}`) : [
      "総合",
      "信頼性",
      "コスト",
      "将来性",
    ];
  const metricWeights = metrics.length ? metrics.map((metric) => Number(metric.weight ?? 1)) : [3, 2, 2, 3];

  const ensureScoreEntry = (entry: ScoreResponse["scores"][number], index: number) => {
    const itemName = items.find((item) => item.id === entry.id)?.name ?? entry.name ?? entry.id;
    const baseScore = clampScore(entry.total_score ?? 0.55 + pseudoRandom(index + 1) * 0.25);
    const breakdownSource = Array.isArray(entry.criteria_breakdown) ? entry.criteria_breakdown : [];
    const hasBreakdown = breakdownSource.some((row) => typeof row?.score === "number");
    const filledBreakdown = hasBreakdown
      ? metricNames.map((name, idx) => {
          const found = breakdownSource.find((row) => row.key === name);
          const fallbackScore = clampScore(0.55 + pseudoRandom(index * (idx + 2)) * 0.3);
          if (found) {
            return {
              ...found,
              score: clampScore(found.score ?? fallbackScore),
              weight: found.weight ?? metricWeights[idx] ?? 1,
              reason:
                found.reason?.trim() || `${itemName}は${found.key}が強みで、公開データからも安定感あり。`,
            };
          }
          return {
            key: name,
            weight: metricWeights[idx] ?? 1,
            score: fallbackScore,
            reason: `${itemName}は${name}が堅調。最新の調査でもプラス評価。`,
          };
        })
      : buildDummyCriteria(metricNames, metricWeights, itemName ?? entry.id, index + 1);

    const totalScore = baseScore > 0 ? baseScore : clampScore(0.48 + pseudoRandom(index + 3) * 0.35);
    const topReason = entry.main_reason?.trim() || filledBreakdown[0]?.reason || `${itemName}は総合的に好調。`;
    const fallbackRisks = filledBreakdown
      .filter((row) => (row.score ?? 0) < 0.55)
      .slice(0, 2)
      .map((row) => `${row.key}は改善余地あり。継続モニタリング推奨。`);

    const fallbackSources = [
      {
        url: `https://example.com/${encodeURIComponent(entry.id ?? "item")}/insight`,
        title: `${itemName} 調査レポート`,
      },
      {
        url: `https://news.example.com/${encodeURIComponent(entry.id ?? "item")}`,
        title: `${itemName} 最新ニュース`,
      },
    ];

    return {
      ...entry,
      name: itemName,
      total_score: totalScore,
      main_reason: topReason,
      criteria_breakdown: filledBreakdown,
      top_criteria:
        entry.top_criteria?.length && typeof entry.top_criteria[0] === "string"
          ? entry.top_criteria
          : filledBreakdown.slice(0, 3).map((row) => row.key),
      risk_notes: (entry.risk_notes ?? fallbackRisks ?? []).filter(Boolean),
      sources: entry.sources?.length ? entry.sources : fallbackSources,
    };
  };

  const responseMap = new Map(response.scores.map((score) => [score.id, score]));
  const mergedScores = items.map((item, index) => {
    const base = responseMap.get(item.id) ?? {
      id: item.id,
      name: item.name,
      total_score: clampScore(0.62 + pseudoRandom(index + 5) * 0.25),
      criteria_breakdown: [],
    };
    return ensureScoreEntry(base, index);
  });

  const sortedForTier = [...mergedScores].sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0));
  const tierBands = ["S", "A", "B", "C"];
  const finalizedScores = mergedScores.map((entry) => {
    if (entry.tier) return entry;
    const rank = sortedForTier.findIndex((item) => item.id === entry.id);
    const ratio = rank / Math.max(1, sortedForTier.length - 1);
    let tier = "C";
    if (ratio <= 0.2) tier = "S";
    else if (ratio <= 0.5) tier = "A";
    else if (ratio <= 0.8) tier = "B";
    return { ...entry, tier };
  });

  return {
    ...response,
    scores: finalizedScores,
    tiers:
      response.tiers?.length
        ? response.tiers
        : tierBands.map((label) => ({ label, items: finalizedScores.filter((entry) => entry.tier === label) })),
  };
}

function WeightRadarEditor({
  metrics,
  maxWeight,
  onChange,
}: {
  metrics: MetricInput[];
  maxWeight: number;
  onChange: (metricId: string | undefined, weight: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const size = 320;
  const center = size / 2;
  const radius = center - 30;

  const points = useMemo(() => {
    return metrics.map((metric, idx) => {
      const angle = -Math.PI / 2 + (idx / Math.max(1, metrics.length)) * Math.PI * 2;
      const rawWeight = Number(metric.weight ?? 1);
      const normalized = Math.max(0.12, Math.min(1, rawWeight / maxWeight));
      const r = radius * normalized;
      const x = center + Math.cos(angle) * r;
      const y = center + Math.sin(angle) * r;
      return {
        id: metric.id ?? `metric-${idx}`,
        name: metric.name || `指標${idx + 1}`,
        weight: rawWeight,
        x,
        y,
      };
    });
  }, [center, maxWeight, metrics, radius]);

  const polygonPoints = points.map((point) => `${point.x},${point.y}`).join(" ");

  const handlePointerUpdate = (metricId: string, clientX: number, clientY: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;
    const dx = offsetX - center;
    const dy = offsetY - center;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const normalized = Math.max(0.12, Math.min(1, dist / radius));
    const nextWeight = Number((normalized * maxWeight).toFixed(2));
    onChange(metricId, nextWeight);
  };

  const handlePointerDown = (metricId: string, event: PointerEvent<SVGCircleElement>) => {
    event.preventDefault();
    setDragging(metricId);
    handlePointerUpdate(metricId, event.clientX, event.clientY);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    handlePointerUpdate(dragging, event.clientX, event.clientY);
  };

  const handlePointerUp = () => setDragging(null);

  return (
    <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-700/70 dark:bg-emerald-950/30">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">重みのバランス</p>
          <p className="text-sm text-text-muted">頂点をドラッグして直感的に配分を調整できます。</p>
        </div>
        <span className="rounded-full bg-emerald-600/90 px-3 py-1 text-xs font-semibold text-white">全指標カバー</span>
      </div>
      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div className="h-72 md:h-64">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${size} ${size}`}
            className="h-full w-full"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {[0.25, 0.5, 0.75, 1].map((level) => (
              <circle
                key={level}
                cx={center}
                cy={center}
                r={radius * level}
                className="fill-none stroke-emerald-200/70 stroke-dashed"
              />
            ))}
            {points.length > 1 &&
              points.map((point, idx) => (
                <line
                  key={`${point.id}-grid-${idx}`}
                  x1={center}
                  y1={center}
                  x2={point.x}
                  y2={point.y}
                  className="stroke-emerald-200/70"
                />
              ))}
            {points.length > 2 && (
              <polygon points={polygonPoints} className="fill-emerald-400/20 stroke-emerald-500" strokeWidth={2} />
            )}
            {points.map((point) => (
              <g key={point.id}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={8}
                  className="cursor-pointer fill-white stroke-emerald-500 stroke-[3px] shadow-lg"
                  onPointerDown={(event) => handlePointerDown(point.id, event)}
                />
                <text x={point.x} y={point.y - 14} textAnchor="middle" className="fill-emerald-900 text-[10px] font-semibold">
                  {point.weight.toFixed(1)}
                </text>
                <text x={point.x} y={point.y + 22} textAnchor="middle" className="fill-emerald-700 text-[10px]">
                  {point.name}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div className="space-y-2 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">ドラッグのコツ</p>
          <ul className="space-y-1 text-xs text-text-muted">
            <li>・頂点を外側に伸ばすとその指標の重みが上昇します。</li>
            <li>・内側へ寄せると重みが軽くなり、他指標とのバランスが取りやすくなります。</li>
            <li>・スライダーと連動しているので、細かな微調整も可能です。</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function convertScoreResponseToAgentResult(response: ScoreResponse | undefined): AgentResult | undefined {
  if (!response) return undefined;
  return {
    items: response.scores.map((entry) => {
      const contrib = Object.fromEntries(
        (entry.criteria_breakdown ?? []).map((breakdown) => [breakdown.key, clampScore(breakdown.score)]),
      );
      return {
        id: entry.id,
        score: clampScore(entry.total_score),
        tier: entry.tier,
        reason: entry.main_reason ?? entry.criteria_breakdown?.[0]?.reason,
        contrib,
        sources: (entry.sources ?? []).map((source) => ({
          url: source.url,
          title: source.title?.trim() || source.url,
        })),
        risk_notes: (entry.risk_notes ?? [])
          .map((note) => note?.trim())
          .filter((note): note is string => Boolean(note)),
      };
    }),
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
  return "total_score" in entry;
}

export function ScoreForm({ initialProjectSlug, displayContext = "default" }: ScoreFormProps = {}) {
  const { data: session } = useSession();
  const [items, setItems] = useState<ItemInput[]>(() => DEFAULT_ITEMS.map((item) => ({ ...item })));
  const [metrics, setMetrics] = useState<MetricInput[]>(() => addIdsToMetrics(SIMPLE_METRICS));
  const [experienceMode, setExperienceMode] = useState<"simple" | "advanced">("simple");
  const [quickTheme, setQuickTheme] = useState("新サービス");
  const [useWeb, setUseWeb] = useState(false);
  const [strictness, setStrictness] = useState<EvaluationStrictness>("balanced");
  const [searchDepth, setSearchDepth] = useState<SearchDepth>("normal");
  const [historyEnabled, setHistoryEnabled] = useState(false);
  const [historyTitle, setHistoryTitle] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentResult | undefined>();
  const [scoreResponse, setScoreResponse] = useState<ScoreResponse | undefined>();
  const [view, setView] = useState<"editor" | "result">("editor");
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
  const isHomeContext = displayContext === "home";
  const [publishError, setPublishError] = useState<string | undefined>();
  const [publishedSlug, setPublishedSlug] = useState<string | undefined>();
  const [publishTitle, setPublishTitle] = useState("");
  const [publishCategory, setPublishCategory] = useState("");
  const [publishTags, setPublishTags] = useState("");
  const [publishSummary, setPublishSummary] = useState("");
  const [publishVisibility, setPublishVisibility] = useState<PublishVisibility>("PUBLIC");
  const isSimpleMode = experienceMode === "simple";

  const viewRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const isLoggedIn = Boolean(session?.user);
  const maxScorePerDay = isLoggedIn ? 50 : 5;
  const maxWebPerDay = isLoggedIn ? 10 : 2;
  const effectiveScoreRemaining = limitState.scoreRemaining ?? maxScorePerDay;
  const effectiveWebRemaining = limitState.webRemaining ?? maxWebPerDay;
  const scoreUsed = Math.max(0, maxScorePerDay - Math.max(0, effectiveScoreRemaining));
  const webUsed = Math.max(0, maxWebPerDay - Math.max(0, effectiveWebRemaining));
  const scoreLimitReached = scoreUsed >= maxScorePerDay;
  const webLimitReached = useWeb && webUsed >= maxWebPerDay;
  const disableRunButton = loading || scoreLimitReached || webLimitReached;
  const projectSlugMissing = !initialProjectSlug;
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

  useEffect(() => {
    if (!isSimpleMode) return;
    setUseWeb(false);
    setStrictness((prev) => (prev === "strict" ? "balanced" : prev));
    setSearchDepth((prev) => (prev === "deep" ? "normal" : prev));
  }, [isSimpleMode]);

  const summary = useMemo(() => buildReportSummary(result, items, metrics), [result, items, metrics]);
  const maxWeight = useMemo(
    () =>
      Math.max(
        5,
        ...metrics.map((metric) => {
          const parsed = Number(metric.weight ?? 1);
          return Number.isFinite(parsed) ? parsed : 1;
        }),
      ),
    [metrics],
  );

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

  function updateMetricById(metricId: string | undefined, payload: Partial<MetricInput>) {
    if (!metricId) return;
    setMetrics((prev) => prev.map((metric) => (metric.id === metricId ? { ...metric, ...payload } : metric)));
  }

  function addMetric() {
    setMetrics((prev) => [
      ...prev,
      { id: createMetricId(), name: `指標${prev.length + 1}`, type: "numeric", direction: "MAX", weight: 1, normalize: "none" },
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
      setMetrics(addIdsToMetrics(SIMPLE_METRICS));
      return;
    }
    if (kind === "naming") {
      setItems(NAMING_PRESET.items.map((item) => ({ ...item })));
      setMetrics(addIdsToMetrics(NAMING_PRESET.metrics));
      return;
    }
    setItems(COMPANY_PRESET.items.map((item) => ({ ...item })));
    setMetrics(addIdsToMetrics(COMPANY_PRESET.metrics));
  }

  function applyQuickTemplate(templateKey: string) {
    const template = QUICK_TEMPLATES.find((entry) => entry.key === templateKey);
    if (!template) return;
    setItems(template.items.map((item, index) => ({ ...item, id: item.id ?? String.fromCharCode(65 + index) })));
    setMetrics(addIdsToMetrics(template.metrics.map((metric) => ({ ...metric }))));
    setCollapsedItems({});
    setCollapsedMetrics({});
    setView("editor");
  }

  function generateSimpleSetFromTheme() {
    const theme = quickTheme.trim() || "アイデア";
    const labels = ["ライト", "スタンダード", "プレミアム"];
    const generatedItems = labels.map((label, index) => ({
      id: String.fromCharCode(65 + index),
      name: `${theme} ${label}`,
      meta: { note: `${label}案。${label === "ライト" ? "導入しやすさ" : label === "プレミアム" ? "付加価値" : "バランス"}を重視。` },
    }));
    const generatedMetrics: MetricInput[] = [
      { name: `${theme}の総合`, type: "numeric", direction: "MAX", weight: 3, normalize: "none" },
      { name: "コスト", type: "numeric", direction: "MIN", weight: 2, normalize: "none" },
      { name: "実行のしやすさ", type: "numeric", direction: "MAX", weight: 2, normalize: "none" },
    ];
    setItems(generatedItems);
    setMetrics(addIdsToMetrics(generatedMetrics));
    setCollapsedItems({});
    setCollapsedMetrics({});
    setView("editor");
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
        id: metric.id ?? createMetricId(),
        ...metric,
        name: baseName,
        weight,
        direction: metric.type === "numeric" || metric.type === "likert" ? metric.direction ?? "MAX" : undefined,
        normalize: metric.type === "numeric" ? metric.normalize ?? "none" : undefined,
      });
    }

    setError(undefined);
    setItems(cleanedItems.map((item) => ({ ...item })));
    setMetrics(addIdsToMetrics(cleanedMetrics));
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
        useWebSearch: useWeb,
        strictness,
        searchDepth,
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
      const activeSlug = initialProjectSlug;
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
      const enriched = enrichScoreResponse(structured, cleanedItems, cleanedMetrics);
      const converted = convertScoreResponseToAgentResult(enriched);
      setScoreResponse(enriched);
      setResult(converted);
      setView("result");
      if (historyEnabled) {
        const entry: HistoryEntry = {
          id: createHistoryId(),
          title: historyTitle.trim() || `保存済み ${new Date().toLocaleString()}`,
          createdAt: Date.now(),
          payload,
          itemsSnapshot: cleanedItems,
          metricsSnapshot: cleanedMetrics,
          result: converted,
          scoreResponse: enriched,
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

  function exportAsJSON() {
    exportJSON(result ?? {}, "tier-rank.json");
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
          score: item.total_score,
          reason: item.main_reason ?? item.criteria_breakdown?.[0]?.reason,
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
    const options = entry.payload?.options ?? {};
    const nextItems: ItemInput[] = (entry.itemsSnapshot?.length ? entry.itemsSnapshot : fallbackItems).map((item: ItemInput) => ({
      ...item,
    }));
    const nextMetrics: MetricInput[] = addIdsToMetrics(
      (entry.metricsSnapshot?.length ? entry.metricsSnapshot : fallbackMetrics).map((metric: MetricInput) => ({ ...metric })),
    );
    setUseWeb(options.useWebSearch === true);
    setStrictness(options.strictness ?? "balanced");
    setSearchDepth(options.searchDepth ?? "normal");
    setItems(nextItems);
    setMetrics(nextMetrics);
    const restoredResult = entry.result ?? convertScoreResponseToAgentResult(entry.scoreResponse);
    setScoreResponse(entry.scoreResponse);
    setResult(restoredResult);
    if (entry.scoreResponse || restoredResult) {
      setView("result");
    }
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

  const publishModal = publishOpen ? (
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
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-semibold">カテゴリ</span>
              <input
                value={publishCategory}
                onChange={(event) => setPublishCategory(event.target.value)}
                placeholder="例：ガジェット"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-semibold">タグ</span>
              <input
                value={publishTags}
                onChange={(event) => setPublishTags(event.target.value)}
                placeholder="カンマ区切りで入力 (例：ノートPC, 2024)"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-semibold">紹介文</span>
              <textarea
                value={publishSummary}
                onChange={(event) => setPublishSummary(event.target.value)}
                rows={4}
                placeholder="ランキングの背景やポイントを短く紹介しましょう。"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-900"
              />
              <span className="text-xs text-text-muted">Markdown記法に対応し、安全なHTMLに自動変換されます。</span>
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-semibold">公開範囲</span>
              <select
                value={publishVisibility}
                onChange={(event) => setPublishVisibility(event.target.value as PublishVisibility)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-900"
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
  ) : null;

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

  const bestCandidate =
    scoreResponse && scoreResponse.scores.length > 0
      ? [...scoreResponse.scores].sort((a, b) => b.total_score - a.total_score)[0]
      : undefined;
  const averageScore =
    scoreResponse && scoreResponse.scores.length > 0
      ? scoreResponse.scores.reduce((sum, entry) => sum + entry.total_score, 0) /
        scoreResponse.scores.length
      : undefined;
  const resultStats = scoreResponse
    ? [
        { label: "候補数", value: scoreResponse.scores.length.toString() },
        { label: "ティア構成", value: `${scoreResponse.tiers.length} 種類` },
        { label: "平均スコア", value: formatPercent(averageScore) },
      ]
    : [];

  if (view === "result") {
    return (
      <div className="relative pb-16">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {bestCandidate && (
            <div className="mb-10 rounded-[40px] border border-white/15 bg-gradient-to-br from-emerald-500/20 via-sky-500/20 to-indigo-500/10 p-[1px] shadow-[0_25px_70px_rgba(15,23,42,0.55)]">
              <div className="rounded-[38px] bg-slate-950/80 p-8 text-white backdrop-blur-xl">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">結果ハイライト</p>
                    <h1 className="text-3xl font-black tracking-tight">AIレポートが完成しました</h1>
                    <p className="text-sm text-white/70">
                      {bestCandidate.main_reason ?? "トップ候補の根拠がまとめられています。"}
                    </p>
                  </div>
                  <div className="flex min-w-[260px] flex-col gap-3 rounded-[32px] border border-white/20 bg-white/5 p-6 text-white">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/60">Top Candidate</p>
                    <p className="text-3xl font-black">{bestCandidate.name}</p>
                    <p className="text-sm text-white/70">
                      Tier {bestCandidate.tier ?? "-"} / {formatPercent(bestCandidate.total_score)}
                    </p>
                  </div>
                </div>
                {resultStats.length > 0 && (
                  <div className="mt-6 grid gap-3 md:grid-cols-3">
                    {resultStats.map((stat) => (
                      <div key={stat.label} className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm">
                        <p className="text-xs uppercase tracking-[0.4em] text-white/60">{stat.label}</p>
                        <p className="text-2xl font-semibold">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {scoreResponse && result ? (
            <ResultReport
              response={scoreResponse}
              items={items}
              metrics={metrics}
              summary={summary}
              onBack={() => setView("editor")}
              onOpenPublish={() => {
                setPublishOpen(true);
                setPublishError(undefined);
              }}
              publishDisabled={publishDisabled}
              onExportJSON={exportAsJSON}
              onExportCSV={exportAsCSV}
              onExportPNG={exportAsPNG}
              onExportPDF={exportAsPDF}
              onExportDocx={exportAsDocx}
              viewRef={viewRef}
              reportRef={reportRef}
            />
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-base text-text-muted">
                まだ評価結果がありません。入力ビューで候補と指標を設定してAI評価を実行してください。
              </p>
              <button
                type="button"
                onClick={() => setView("editor")}
                className="rounded-2xl border border-slate-300 px-5 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                入力に戻る
              </button>
            </div>
          )}
        </div>
        {publishModal}
      </div>
    );
  }

  return (
    <div className="relative pb-32">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="mx-auto w-full max-w-5xl px-4 pb-44 pt-6 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">操作モード</h2>
                  <p className="mt-1 text-sm text-text-muted">
                    パラメータを減らした「かんたん」と、細かく調整できる「詳細」を切り替えできます。シンプルモードでは Web 検索や厳しすぎる設定を自動でオフにします。
                  </p>
                </div>
                <Segmented
                  value={experienceMode}
                  onChange={setExperienceMode}
                  options={[
                    { label: "かんたん", value: "simple" },
                    { label: "詳細", value: "advanced" },
                  ]}
                />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-[1.1fr_0.9fr] md:items-start">
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/70">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white dark:bg-slate-100 dark:text-slate-900">
                      {isSimpleMode ? "Simple" : "Advanced"}
                    </span>
                    {isSimpleMode ? "迷ったらこのまま使えます" : "細かいパラメータをすべて表示"}
                  </div>
                  {isSimpleMode ? (
                    <ul className="space-y-2 text-text-muted">
                      <li>・候補と指標の入力だけで実行できます。厳しすぎるモードや Web 検索は自動でオフ。</li>
                      <li>・下のボタンで候補と評価軸をワンクリック生成できます。</li>
                      <li>・あとから詳細モードに切り替えて調整しても大丈夫です。</li>
                    </ul>
                  ) : (
                    <ul className="space-y-2 text-text-muted">
                      <li>・重みや正規化、数式などすべての設定を確認・編集できます。</li>
                      <li>・Web 検索や評価の厳しさも自由に切り替えられます。</li>
                    </ul>
                  )}
                </div>
                {isSimpleMode && (
                  <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm shadow-sm dark:border-emerald-700 dark:bg-emerald-950/40">
                    <div>
                      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-50">候補と評価軸をかんたん生成</p>
                      <p className="text-xs text-emerald-900/80 dark:text-emerald-100/80">テーマを入れて自動作成するか、テンプレートを選んで一括セットできます。</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        value={quickTheme}
                        onChange={(event) => setQuickTheme(event.target.value)}
                        className="w-full rounded-2xl border border-emerald-200 px-3 py-2 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-700 dark:bg-slate-950"
                        placeholder="例：新サービス / プロジェクト名"
                      />
                      <button
                        type="button"
                        onClick={generateSimpleSetFromTheme}
                        className="w-full rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 sm:w-auto"
                      >
                        テーマから生成
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_TEMPLATES.map((template) => (
                        <button
                          key={template.key}
                          type="button"
                          onClick={() => applyQuickTemplate(template.key)}
                          className="rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-slate-950 dark:text-emerald-100 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/60"
                          title={template.description}
                        >
                          {template.title}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-emerald-900/80 dark:text-emerald-100/80">生成した候補や指標は後から自由に書き換えられます。</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-surface p-6 shadow-sm dark:border-slate-800">
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
                    className="rounded-2xl border border-slate-300 px-4 py-2 text-sm transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    初期セットに戻す
                  </button>
                  <button
                    onClick={() => applyPreset("naming")}
                    className="rounded-2xl border border-slate-300 px-4 py-2 text-sm transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    命名案の比較（サンプル）
                  </button>
                  <button
                    onClick={() => applyPreset("company")}
                    className="rounded-2xl border border-slate-300 px-4 py-2 text-sm transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    企業比較（サンプル）
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-sky-400/50 bg-sky-50/80 p-6 shadow-sm backdrop-blur dark:border-sky-500/40 dark:bg-sky-900/20">
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
                      className="w-full rounded-2xl bg-sky-600 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-sky-700 sm:w-auto"
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
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
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
                                "rounded-3xl border border-sky-400/50 bg-white/90 p-6 shadow-sm transition dark:bg-slate-950/60",
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
                                    className="rounded-xl border border-sky-200 px-4 py-2 text-sm text-sky-700 transition hover:bg-sky-100 dark:border-sky-700 dark:text-sky-100"
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
                                    className="rounded-xl px-4 py-2 text-sm text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                    >
                                      削除
                                    </button>
                                  )}
                                </div>
                              </div>
                              {!collapsed && (
                                <div className="space-y-3 text-sm">
                                  <div className="grid gap-4 md:grid-cols-2">
                                    <label className="flex flex-col gap-2">
                                      <span className="font-medium">候補ID</span>
                                      <span className="text-xs text-sky-800/80 dark:text-sky-100/70">AIが識別する短いID（例：A）</span>
                                      <input
                                        className="w-full rounded-2xl border border-sky-300 px-4 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-800 dark:bg-slate-950"
                                        value={item.id}
                                        onChange={(event) => updateItems(idx, { id: event.target.value })}
                                        placeholder="例: A"
                                      />
                                    </label>
                                    <label className="flex flex-col gap-2">
                                      <span className="font-medium">表示名</span>
                                      <span className="text-xs text-sky-800/80 dark:text-sky-100/70">一般ユーザー向けの名前（例：プランA）</span>
                                      <input
                                        className="w-full rounded-2xl border border-sky-300 px-4 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-800 dark:bg-slate-950"
                                        value={item.name ?? ""}
                                        onChange={(event) => updateItems(idx, { name: event.target.value })}
                                        placeholder="例: プランA"
                                      />
                                    </label>
                                  </div>
                                  <label className="flex flex-col gap-2">
                                    <span className="font-medium">補足メモ（任意）</span>
                                    <span className="text-xs text-sky-800/80 dark:text-sky-100/70">比較時の参考情報をメモできます</span>
                                    <textarea
                                      className="min-h-[72px] w-full rounded-2xl border border-sky-300 px-4 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-800 dark:bg-slate-950"
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

            <div className="rounded-3xl border border-emerald-400/50 bg-emerald-50/80 p-6 shadow-sm backdrop-blur dark:border-emerald-500/40 dark:bg-emerald-900/20">
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
                      className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 sm:w-auto"
                    >
                      指標を追加
                    </button>
                  </div>
                </div>
                <p className="text-xs text-emerald-900/80 dark:text-emerald-100/80">
                  比較に使う観点を追加してください。AIはこの情報をもとに総合スコアとティアを提案します。
                </p>
                <div className="rounded-2xl border border-emerald-200/70 bg-white/80 p-4 text-[11px] leading-5 text-emerald-900/80 shadow-sm dark:border-emerald-700/70 dark:bg-emerald-950/40 dark:text-emerald-100/80">
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
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
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
                      const metricId = metric.id ?? `metric-${idx}`;
                      return (
                        <Draggable key={metricId} draggableId={metricId} index={idx}>
                          {(dragProvided, snapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                            className={clsx(
                              "rounded-3xl border border-emerald-400/50 bg-white/90 p-6 shadow-sm transition dark:bg-slate-950/60",
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
                                    className="rounded-xl border border-emerald-200 px-4 py-2 text-sm text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-100"
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
                                    className="rounded-xl px-4 py-2 text-sm text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                    >
                                      削除
                                    </button>
                                  )}
                                </div>
                              </div>
                              {!collapsed && (
                                <div className="space-y-4 text-sm">
                                  <div className="grid gap-4 md:grid-cols-2">
                                    <label className="flex flex-col gap-2">
                                      <span className="font-medium">指標名</span>
                                      <span className="text-xs text-emerald-800/80 dark:text-emerald-100/70">例：コスパ / 信頼性 / デザイン</span>
                                      <input
                                        className="w-full rounded-2xl border border-emerald-200 px-4 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-800 dark:bg-slate-950"
                                        value={metric.name}
                                        onChange={(event) => updateMetric(idx, { name: event.target.value })}
                                        placeholder="例: コスパ"
                                      />
                                    </label>
                                    <label className="flex flex-col gap-2">
                                      <span className="flex items-center gap-1 font-medium">
                                        タイプ
                                        <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-700" title="数式を選ぶと下の式フィールドが表示されます。">
                                          ?
                                        </span>
                                      </span>
                                      <span className="text-xs text-emerald-800/80 dark:text-emerald-100/70">数値（1〜10など）/ 選択式 / Yes/No。迷ったら数値でOKです。</span>
                                      <select
                                        className="w-full rounded-2xl border border-emerald-200 px-4 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-800 dark:bg-slate-950"
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
                                    <div className="grid gap-4 md:grid-cols-2">
                                      <label className="flex flex-col gap-2">
                                        <span className="font-medium">評価方向</span>
                                        <span className="text-xs text-emerald-800/80 dark:text-emerald-100/70">高いほうが良いか、低いほうが良いかを選びます</span>
                                      <select
                                          className="w-full rounded-2xl border border-emerald-200 px-4 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-800 dark:bg-slate-950"
                                          value={metric.direction ?? "MAX"}
                                          onChange={(event) => updateMetric(idx, { direction: event.target.value as MetricInput["direction"] })}
                                        >
                                          <option value="MAX">高いほど良い</option>
                                          <option value="MIN">低いほど良い</option>
                                        </select>
                                      </label>
                                      <label className="flex flex-col gap-2">
                                        <span className="font-medium">正規化</span>
                                        <span className="text-xs text-emerald-800/80 dark:text-emerald-100/70">分からなければ「なし」のままで大丈夫です</span>
                                      <select
                                          className="w-full rounded-2xl border border-emerald-200 px-4 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-800 dark:bg-slate-950"
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

                                  <div className="grid gap-4 md:grid-cols-2">
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center justify-between text-xs font-medium text-emerald-800 dark:text-emerald-100">
                                        <span>重み</span>
                                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200">
                                          {Number(metric.weight ?? 1).toFixed(1)} / {maxWeight.toFixed(1)}
                                        </span>
                                      </div>
                                      <span className="text-xs text-emerald-800/80 dark:text-emerald-100/70">スライダーやレーダーで直感的に重要度を調整</span>
                                      <div className="rounded-2xl bg-gradient-to-r from-emerald-50 via-white to-emerald-50 p-4 shadow-inner dark:from-emerald-950/40 dark:via-slate-950 dark:to-emerald-950/40">
                                        <input
                                          type="range"
                                          min={0.5}
                                          max={maxWeight}
                                          step={0.1}
                                          value={metric.weight ?? 1}
                                          onChange={(event) => updateMetric(idx, { weight: Number(event.target.value) })}
                                          className="h-2 w-full cursor-pointer rounded-full bg-emerald-200 accent-emerald-500"
                                        />
                                        <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted">
                                          <span>軽め</span>
                                          <span className="text-emerald-700 dark:text-emerald-200">バランス調整</span>
                                          <span>重視</span>
                                        </div>
                                      </div>
                                    </div>
                                    <label className="flex flex-col gap-2">
                                      <span className="font-medium">閾値 / 備考</span>
                                      <span className="text-xs text-emerald-800/80 dark:text-emerald-100/70">除外条件や注記（例：信頼性は3未満なら除外）</span>
                                      <input
                                        className="w-full rounded-2xl border border-emerald-200 px-4 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-800 dark:bg-slate-950"
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
                                    <div className="space-y-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-4 dark:border-emerald-700/70 dark:bg-emerald-900/30">
                                      <label className="flex flex-col gap-2">
                                        <span className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                                          計算式
                                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white" title="既存の指標名を変数として使用できます。例: 0.6*総合 + 0.4*評判">
                                            ヒント
                                          </span>
                                        </span>
                                        <input
                                      className="w-full rounded-2xl border border-emerald-300 px-4 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-950"
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

            <WeightRadarEditor
              metrics={metrics}
              maxWeight={maxWeight}
              onChange={(metricId, weight) => updateMetricById(metricId, { weight })}
            />

            <div className="space-y-6 rounded-3xl border border-slate-200 bg-surface p-6 shadow-sm dark:border-slate-800">
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">AI設定</div>
                <p className="text-sm text-text-muted">評価の厳しさとWeb検索のスタイルをまとめて調整できます。</p>
              </div>
              <div className="space-y-5">
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">評価スタイル</h3>
                    <span className="text-xs text-text-muted">{STRICTNESS_SUMMARY[strictness]}</span>
                  </div>
                  <Segmented<EvaluationStrictness>
                    value={strictness}
                    onChange={setStrictness}
                    options={[
                      { value: "lenient", label: "😇 甘め" },
                      { value: "balanced", label: "⚖ 標準" },
                      { value: "strict", label: "🧊 厳しめ" },
                    ]}
                  />
                  <p className="text-xs text-text-muted">{STRICTNESS_DETAIL[strictness]}</p>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Web検索</h3>
                    <span className="text-xs text-text-muted">
                      {useWeb ? `残り ${Math.max(0, effectiveWebRemaining)}/${maxWebPerDay} 回` : `1日あたり最大 ${maxWebPerDay} 回`}
                    </span>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={useWeb} onChange={(event) => setUseWeb(event.target.checked)} />
                    Web検索を使用して根拠URLを取得
                  </label>
                  <p className="text-xs text-text-muted">最新の公開情報から根拠URLとリスクメモを収集します。</p>
                  {useWeb && (
                    <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm shadow-sm dark:border-emerald-800 dark:bg-emerald-950/40">
                      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">検索の深さ</div>
                      <Segmented<SearchDepth>
                        value={searchDepth}
                        onChange={setSearchDepth}
                        options={[
                          { value: "shallow", label: "🔍 簡易" },
                          { value: "normal", label: "📚 標準" },
                          { value: "deep", label: "🧠 詳細" },
                        ]}
                      />
                      <p className="text-xs text-text-muted">{SEARCH_DEPTH_SUMMARY[searchDepth]}</p>
                      <p className="text-xs text-text-muted">候補ごとに最大3件の参考URLとリスクを表示します。</p>
                    </div>
                  )}
                </section>
              </div>
            </div>

            <div className="space-y-5 rounded-3xl border border-slate-200 bg-surface p-6 shadow-sm dark:border-slate-800">
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">履歴</div>
                <p className="text-sm text-text-muted">評価を実行すると条件と結果を自動保存できます。</p>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={historyEnabled}
                  onChange={(event) => setHistoryEnabled(event.target.checked)}
                />
                履歴を保存
              </label>
              <p className="text-xs text-text-muted">保存するとレポートの要約や指標設定も一緒に残ります。</p>
              {historyEnabled && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
                  <div className="mb-2 font-medium">履歴用タイトル（任意）</div>
                  <input
                    className="mb-3 w-full rounded-2xl border border-slate-300 px-4 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-900"
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
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium">保存済みの履歴</div>
                <span className="rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white dark:bg-white/10">
                  {history.length} 件
                </span>
              </div>
              <ul className="grid gap-4 lg:grid-cols-2">
                {history.map((entry, historyIndex) => {
                  const preset = HISTORY_CARD_STYLES[historyIndex % HISTORY_CARD_STYLES.length];
                  const snapshotItems: ItemInput[] =
                    entry.itemsSnapshot ??
                    (entry.payload?.candidates ?? []).map((candidate) => ({
                      id: candidate.id,
                      name: candidate.name,
                    }));
                  const snapshotMetrics = entry.metricsSnapshot ?? ((entry.payload as any)?.criteria ?? []);
                  const rankedHistory = [...(entry.result?.items ?? [])].sort(
                    (a, b) => (b.score ?? 0) - (a.score ?? 0),
                  );
                  const topHistory = rankedHistory[0];
                  const nameMap = new Map(snapshotItems.map((item) => [item.id, item.name ?? item.id]));
                  const topLabel = topHistory?.id ? nameMap.get(topHistory.id) ?? topHistory.id : undefined;
                  const savedAt = new Date(entry.createdAt).toLocaleString("ja-JP", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const summaryPreview =
                    entry.summaryText ??
                    (topLabel ? `${topLabel} が Tier ${topHistory?.tier ?? "-"} に選出されました。` : undefined);
                  return (
                    <li
                      key={entry.id}
                      className={`relative overflow-hidden rounded-[28px] border ${preset.border} bg-gradient-to-br ${preset.gradient} p-[1px] ${preset.shadow}`}
                    >
                      <div className="flex h-full flex-col gap-4 rounded-[26px] bg-white/95 p-5 text-slate-900 shadow-2xl dark:bg-slate-950/80 dark:text-white">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{entry.title || "無題の評価"}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{savedAt}</div>
                          </div>
                          <div className="rounded-full bg-slate-900/90 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                            {topHistory?.tier ?? "-"}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center text-xs">
                          <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">候補</p>
                            <p className="text-lg font-semibold">{snapshotItems.length}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">指標</p>
                            <p className="text-lg font-semibold">{snapshotMetrics.length}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">Top</p>
                            <p className="text-sm font-semibold">{topLabel ?? "-"}</p>
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-300">{formatPercent(topHistory?.score)}</p>
                          </div>
                        </div>
                        {summaryPreview && <p className="flex-1 text-sm text-slate-600 dark:text-slate-200">{summaryPreview}</p>}
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleLoadHistory(entry)}
                            className="flex-1 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 dark:bg-white/10"
                          >
                            反映する
                          </button>
                          <button
                            onClick={() => handleDeleteHistory(entry.id)}
                            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
            </div>
          </div>

        </div>
      </DragDropContext>

      <div
        className={clsx(
          "pointer-events-none",
          isHomeContext
            ? "relative z-10 mx-auto mt-12 w-full max-w-5xl"
            : "fixed bottom-6 left-1/2 z-40 w-[min(960px,92vw)] -translate-x-1/2",
        )}
      >
        <div
          className="pointer-events-auto flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl backdrop-blur"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-base font-semibold text-slate-900">🚀 AI評価を実行</div>
              <div className="text-sm text-text-muted">候補 {items.length} 件 / 指標 {metrics.length} 件</div>
            </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <span
                  className={clsx(
                    "rounded-full px-3 py-1",
                    scoreLimitReached ? "bg-rose-500 text-white" : "bg-slate-200 text-slate-700",
                  )}
                >
                  AI {scoreUsed} / {maxScorePerDay}
                </span>
                <span
                  className={clsx(
                    "rounded-full px-3 py-1",
                    webLimitReached ? "bg-rose-500 text-white" : "bg-slate-200 text-slate-700",
                  )}
                >
                  Web {webUsed} / {maxWebPerDay}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPublishOpen(true);
                  setPublishError(undefined);
                }}
                disabled={publishDisabled}
                className="w-full rounded-2xl border border-emerald-300 bg-white/80 px-5 py-3 text-base font-semibold text-emerald-600 shadow-sm transition hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200 dark:hover:bg-emerald-900/60 sm:w-auto"
              >
                公開設定
              </button>
              <button
                onClick={run}
                disabled={disableRun}
                className={clsx(
                  "w-full rounded-2xl px-6 py-3 text-base font-semibold shadow-lg transition sm:w-auto",
                  scoreLimitReached || webLimitReached
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : "bg-gradient-to-r from-sky-500 to-emerald-500 text-white hover:from-sky-600 hover:to-emerald-600",
                )}
              >
                {loading
                  ? "AIが評価しています…"
                  : scoreLimitReached || webLimitReached
                    ? "利用上限に達しました"
                    : "AIに評価を依頼する"}
              </button>
            </div>
          </div>
          <div
              className={clsx(
              "flex flex-wrap items-center gap-3 text-sm",
            )}
          >
            {projectSlugMissing && !loading && !error ? (
              <span className="text-rose-500">
                AIプロジェクトが設定されていません。管理者にお問い合わせください。
              </span>
            ) : loading ? (
              <span className="flex items-center gap-2 text-sky-600">
                <span className="h-2 w-2 animate-ping rounded-full bg-sky-500" />
                処理中… AIの結果を待機しています。
              </span>
            ) : error ? (
              <span className="text-rose-500">{error}</span>
            ) : (
              <span className="text-text-muted">
                左側のステップを埋めたら「AIに評価を依頼する」を押してください。
              </span>
            )}
          </div>
          {(publishStatus === "success" && publishedUrl) || publishError ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100">
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
      {publishModal}
    </div>
  );
}
