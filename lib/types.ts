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

export type ScoreRequest = {
  candidates: Candidate[];
  criteria: Criterion[];
  options?: {
    tiers?: string[];
    useWebSearch?: boolean;
  };
};

export type AgentItem = {
  id: string;
  score?: number;
  contrib?: Record<string, number>;
  tier?: string;
  reason?: string;
  sources?: { url: string; title: string }[];
};

export type AgentResult = {
  items?: AgentItem[];
  meta?: { confidence?: "A" | "B" | "C" };
  error?: string;
  raw?: string;
};

export type TierItemResult = {
  id: string;
  name: string;
  score: number;
  reasons?: string;
};

export type TierResult = {
  label: string;
  items: TierItemResult[];
};

export type ScoreResponse = {
  tiers: TierResult[];
  scores: {
    id: string;
    name: string;
    score: number;
    tier: string;
    reasons?: string;
  }[];
  sources?: {
    id: string;
    urls: string[];
  }[];
};
