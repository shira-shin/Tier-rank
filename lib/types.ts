export type ItemInput = { id: string; name: string; meta?: any };
export type MetricInput = {
  name: string;
  type: "numeric" | "boolean" | "likert";
  direction: "MAX" | "MIN" | "TARGET" | "LOG";
  weight: number;
  threshold?: number;
  params?: any;
};
export type ScorePayload = {
  items: ItemInput[];
  metrics: MetricInput[];
  use_web_search?: boolean;
};
export type AgentItem = {
  id: string;
  score: number; // 0..1
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
