import type { AgentResult, ItemInput, MetricInput } from "./types";

type TierKey = "S" | "A" | "B" | "C";

export type ReportSection = {
  title: string;
  paragraphs: string[];
};

export type ReportSummary = {
  title: string;
  subtitle: string;
  sections: ReportSection[];
  plainText: string;
};

const TIERS: TierKey[] = ["S", "A", "B", "C"];

function formatPercent(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

export function buildReportSummary(
  result: AgentResult | undefined,
  items: ItemInput[],
  metrics: MetricInput[],
): ReportSummary | undefined {
  const evaluatedItems = (result?.items ?? []).filter((item) => item.id);
  if (evaluatedItems.length === 0) return undefined;

  const nameMap = new Map(items.map((i) => [i.id, i.name ?? i.id]));
  const ranked = [...evaluatedItems].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const title = "レポート要約";
  const subtitle = `評価対象 ${evaluatedItems.length} 件 / 指標 ${metrics.length} 件`;

  const highlight = ranked.slice(0, 3).map((item, idx) => {
    const label = nameMap.get(item.id) ?? item.id;
    const reason = item.reason ? `理由: ${item.reason}` : "総合スコアが高評価";
    return `${idx + 1}位 ${label}（${formatPercent(item.score)}） — ${reason}`;
  });

  const tierSection = TIERS.map((tier) => {
    const entries = ranked.filter((item) => item.tier === tier);
    if (entries.length === 0) {
      return `${tier} ティア: 該当なし`;
    }
    const summary = entries
      .map((item) => `${nameMap.get(item.id) ?? item.id}（${formatPercent(item.score)}）`)
      .join("、");
    return `${tier} ティア: ${summary}`;
  });

  const metricInsights = metrics.length
    ? metrics.map((metric) => {
        const { name, direction, type } = metric;
        const sortedByMetric = ranked
          .map((item) => ({
            item,
            value: item.contrib?.[name] ?? item.score ?? 0,
          }))
          .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
        const top = sortedByMetric[0];
        if (!top) {
          return `${name}: 評価データが不足しています。`;
        }
        const label = nameMap.get(top.item.id ?? "") ?? top.item.id ?? "-";
        const valueText = formatPercent(top.value);
        const directionText =
          type === "formula"
            ? "数式指標"
            : direction === "MIN"
              ? "低いほど高評価"
              : "高いほど高評価";
        return `${name}: ${label} が最も評価されました（${valueText} / ${directionText}）。`;
      })
    : ["評価指標が設定されていないため、個別の考察はありません。評価軸を追加すると詳細が生成されます。"];

  const sections: ReportSection[] = [
    {
      title: "ハイライト",
      paragraphs: highlight.length ? highlight : ["上位の候補がまだ算出されていません。"],
    },
    {
      title: "ティア構成",
      paragraphs: tierSection,
    },
    {
      title: "指標別の着眼点",
      paragraphs: metricInsights,
    },
  ];

  const plainLines = [
    title,
    subtitle,
    "",
    ...sections.flatMap((section) => [section.title, ...section.paragraphs, ""]),
  ];
  const plainText = plainLines.join("\n").trim();

  return {
    title,
    subtitle,
    sections,
    plainText,
  };
}
