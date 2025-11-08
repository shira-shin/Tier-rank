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

export type ScorePayload = {
  items: ItemInput[];
  metrics: MetricInput[];
  use_web_search?: boolean;
};

export type AgentItem = {
  id: string;
  score?: number;
  contrib?: Record<string, number>;
  tier?: "S" | "A" | "B" | "C";
  reason?: string;
  sources?: { url: string; title: string }[];
};

export type AgentResult = {
  items?: AgentItem[];
  meta?: { confidence?: "A" | "B" | "C" };
  error?: string;
  raw?: string;
};
