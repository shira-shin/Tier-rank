export type MetricType = "numeric" | "likert" | "boolean" | "formula";

export type NormalizeStrategy = "minmax" | "zscore" | "none";

export type ItemInput = {
  id: string;
  name: string;
  meta?: any;
};

export type UIMetric = {
  name: string;
  type: MetricType;
  direction?: "MAX" | "MIN";
  weight?: number;
  target?: number | string;
  formula?: string;
  normalize?: NormalizeStrategy;
  description?: string;
  params?: Record<string, unknown>;
};

export type MetricInput = UIMetric;

export type Candidate = {
  id: string;
  name: string;
  description?: string;
};

export type Criterion = {
  key: string;
  label: string;
  direction: "up" | "down";
  weight: number;
  type: MetricType;
  note?: string;
};

export type EvaluationStrictness = "lenient" | "balanced" | "strict";

export type SearchDepth = "shallow" | "normal" | "deep";

export type ScoreRequest = {
  candidates: Candidate[];
  criteria: Criterion[];
  options?: {
    tiers?: string[];
    useWebSearch?: boolean;
    strictness?: EvaluationStrictness;
    searchDepth?: SearchDepth;
  };
};

export type AgentItem = {
  id: string;
  name?: string;
  score?: number;
  contrib?: Record<string, number>;
  tier?: string;
  reason?: string;
  sources?: { url: string; title: string }[];
  risk_notes?: string[];
};

export type AgentResult = {
  items?: AgentItem[];
  meta?: { confidence?: "A" | "B" | "C" };
  error?: string;
  raw?: string;
};

export type SourceReference = {
  url: string;
  title?: string;
  note?: string;
};

export type CriteriaBreakdownEntry = {
  key: string;
  score: number;
  weight: number;
  reason: string;
};

export type TierItemResult = {
  id: string;
  name: string;
  score: number;
  main_reason?: string;
  top_criteria?: string[];
};

export type TierResult = {
  label: string;
  items: TierItemResult[];
};

export type ScoreRow = {
  id: string;
  name: string;
  total_score: number;
  tier: string;
  main_reason?: string;
  top_criteria?: string[];
  criteria_breakdown: CriteriaBreakdownEntry[];
  sources?: SourceReference[];
  risk_notes?: string[];
};

export type ScoreResponse = {
  ok?: boolean;
  tiers: TierResult[];
  scores: ScoreRow[];
};
