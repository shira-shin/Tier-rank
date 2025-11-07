export type ScorePayload = {
  items: Array<{ id: string; name: string; meta?: any }>;
  metrics: Array<{
    name: string;
    type: "numeric" | "boolean" | "likert";
    direction: "MAX" | "MIN" | "TARGET" | "LOG";
    weight: number;
    threshold?: number;
    params?: any;
  }>;
  use_web_search?: boolean;
};

export async function scoreWithAgent(payload: ScorePayload) {
  const schema = `Return STRICT JSON: {"items":[{"id":"string","score":0..1,"contrib":{"<metric>":0..1},"tier":"S|A|B|C","reason":"<=200 chars","sources":[{"url":"string","title":"string"}]}],"meta":{"confidence":"A|B|C"}}`;

  const input = [
    { role: "system", content: "You are a precise scoring agent. Output strict JSON only. No prose, no markdown." },
    { role: "user", content: schema },
    { role: "user", content: "Compute normalized scores from items+metrics. If web_search used, cite 1-3 reliable sources." },
    { role: "user", content: JSON.stringify(payload) }
  ];

  const body: any = { model: "gpt-4.1-mini", modalities: ["text"], input };
  if (payload.use_web_search) body.tools = [{ type: "web_search" }];

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const j = await r.json();
  const text = j?.output?.[0]?.content?.[0]?.text ?? j?.output_text ?? "";
  try { return JSON.parse(text); } catch {
    return { error: "PARSE_ERROR", raw: text };
  }
}
