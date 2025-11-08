import type { AgentResult, UIMetric } from "@/lib/types";
import { evalFormula } from "@/lib/formula";

export function applyFormulaMetrics(res: AgentResult, metrics: UIMetric[]): AgentResult {
  const formulaMetrics = metrics.filter((metric) => metric.type === "formula" && metric.formula);
  if (!res?.items || formulaMetrics.length === 0) return res;

  for (const item of res.items) {
    item.contrib ||= {};
    for (const metric of formulaMetrics) {
      try {
        const scope: Record<string, number> = {};
        for (const [key, raw] of Object.entries(item.contrib)) {
          const value = Number(raw);
          if (!Number.isNaN(value)) scope[key] = value;
        }
        if (typeof item.score === "number") scope.score = item.score;
        const evaluated = evalFormula(metric.formula!, scope);
        item.contrib[metric.name] = Number(evaluated);
      } catch {
        // ignore evaluation errors for individual metrics
      }
    }
  }

  return res;
}
