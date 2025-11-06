export type ScorePayload = {
  items: unknown;
  metrics: unknown;
  use_web_search?: boolean;
  projectId?: string;
};

type AgentError =
  | { error: "NO_API_KEY" }
  | { error: "API_ERROR"; status: number; raw: string }
  | { error: "PARSE_ERROR"; raw: string };

type AgentSuccess = Record<string, unknown>;

function extractOutputText(payload: any): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const textParts: string[] = [];

  if (Array.isArray(payload.output_text)) {
    textParts.push(...payload.output_text.filter((part) => typeof part === "string"));
  }

  if (Array.isArray(payload.output)) {
    for (const block of payload.output) {
      if (!block || typeof block !== "object" || !Array.isArray(block.content)) {
        continue;
      }

      for (const contentItem of block.content) {
        if (!contentItem || typeof contentItem !== "object") {
          continue;
        }

        if (typeof contentItem.text === "string") {
          textParts.push(contentItem.text);
        } else if (typeof contentItem.output_text === "string") {
          textParts.push(contentItem.output_text);
        } else if (contentItem.type === "output_text" && typeof contentItem?.content === "string") {
          textParts.push(contentItem.content);
        }
      }
    }
  }

  if (!textParts.length && typeof payload.output_text === "string") {
    textParts.push(payload.output_text);
  }

  if (!textParts.length && typeof payload.output === "string") {
    textParts.push(payload.output);
  }

  return textParts.join("").trim();
}

export async function scoreWithAgent(payload: ScorePayload): Promise<AgentSuccess | AgentError> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return { error: "NO_API_KEY" };
  }

  const systemPrompt = `You are a precise scoring agent. Respond with strict JSON only. Use the following schema:\n{\n  "items":[{"id":"string","score":0..1,"contrib":{"<metric>":0..1},"tier":"S|A|B|C","reason":"<=200 chars","sources":[{"url":"string","title":"string"}]}],\n  "meta":{"confidence":"A"|"B"|"C"}\n}`;

  const userPayload = {
    projectId: payload.projectId ?? null,
    items: payload.items,
    metrics: payload.metrics,
  };

  const body: Record<string, unknown> = {
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "text",
            text: systemPrompt,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Evaluate the provided items using the provided metrics and respond strictly with JSON matching the schema.\nInput:\n${JSON.stringify(userPayload, null, 2)}`,
          },
        ],
      },
    ],
  };

  if (payload.use_web_search) {
    body.tools = [{ type: "web_search" }];
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const raw = await response.text();
    return { error: "API_ERROR", status: response.status, raw };
  }

  const data = await response.json();
  const outputText = extractOutputText(data);

  try {
    return JSON.parse(outputText);
  } catch (error) {
    const fallback = outputText || JSON.stringify(data);
    return { error: "PARSE_ERROR", raw: fallback };
  }
}
