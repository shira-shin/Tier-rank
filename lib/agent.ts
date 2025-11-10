import type { AgentResult, ScorePayload } from "@/lib/types";

function formatError(message: string, raw?: unknown): AgentResult {
  const output: AgentResult = { error: message };
  if (raw !== undefined) {
    output.raw = typeof raw === "string" ? raw : JSON.stringify(raw);
  }
  return output;
}

export async function scoreWithAgent(payload: ScorePayload): Promise<AgentResult> {
  const schema = `Return STRICT JSON:{"items":[{"id":"string","score":0..1,"contrib":{"<metric>":0..1},"tier":"S|A|B|C","reason":"<=200 chars","sources":[{"url":"string","title":"string"}]}],"meta":{"confidence":"A|B|C"}}`;

  const input = [
    { role: "system", content: "You are a precise scoring agent. Output strict JSON only. No prose, no markdown." },
    { role: "user", content: schema },
    { role: "user", content: "Compute normalized scores from items+metrics. If web_search used, cite 1-3 reliable sources." },
    { role: "user", content: JSON.stringify(payload) }
  ];

  const body: any = { model: "gpt-4.1-mini", modalities: ["text"], input };
  if (payload.use_web_search) body.tools = [{ type: "web_search" }];

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return formatError("NETWORK_ERROR", message);
  }

  let rawBody = "";
  let parsedBody: any;
  try {
    rawBody = await response.text();
    parsedBody = rawBody ? JSON.parse(rawBody) : undefined;
  } catch {
    parsedBody = undefined;
  }

  if (!response.ok) {
    return formatError("UPSTREAM_ERROR", rawBody || parsedBody);
  }

  const textOutput =
    parsedBody?.output?.[0]?.content?.[0]?.text ??
    parsedBody?.output_text ??
    (typeof rawBody === "string" ? rawBody : "");

  if (!textOutput) {
    return formatError("EMPTY_RESPONSE", rawBody);
  }

  try {
    return JSON.parse(textOutput) as AgentResult;
  } catch {
    return formatError("PARSE_ERROR", textOutput);
  }
}
