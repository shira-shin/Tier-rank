export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type {
  ScoreRequest as ScoreRequestPayload,
  ScoreResponse as ScoreResponsePayload,
  MetricType,
  EvaluationStrictness,
  SearchDepth,
} from "@/lib/types";

const metricTypeValues = ["numeric", "likert", "boolean", "formula"] as const satisfies readonly MetricType[];
const evaluationStrictnessValues = ["lenient", "balanced", "strict"] as const satisfies readonly EvaluationStrictness[];
const searchDepthValues = ["shallow", "normal", "deep"] as const satisfies readonly SearchDepth[];

const candidateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

const criterionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  direction: z.enum(["up", "down"]),
  weight: z.number().gt(0),
  type: z.enum(metricTypeValues),
  note: z.string().optional(),
});

const scoreRequestSchema = z.object({
  candidates: z.array(candidateSchema),
  criteria: z.array(criterionSchema),
  options: z
    .object({
      tiers: z.array(z.string().min(1)).min(1).max(10).optional(),
      useWebSearch: z.boolean().optional(),
      strictness: z.enum(evaluationStrictnessValues).optional(),
      searchDepth: z.enum(searchDepthValues).optional(),
    })
    .optional(),
});

const sourceEntrySchema = z.object({
  url: z.string().url(),
  title: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
});

const criteriaBreakdownSchema = z.object({
  key: z.string().min(1),
  score: z.number(),
  weight: z.number(),
  reason: z.string().min(1),
});

const tierItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  score: z.number(),
  main_reason: z.string().optional(),
  top_criteria: z.array(z.string().min(1)).min(1).max(5).optional(),
});

const tierResultSchema = z.object({
  label: z.string(),
  items: z.array(tierItemSchema),
});

const scoreEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  total_score: z.number(),
  tier: z.string(),
  main_reason: z.string().optional(),
  top_criteria: z.array(z.string().min(1)).min(1).max(5).optional(),
  criteria_breakdown: z.array(criteriaBreakdownSchema).min(1).max(20),
  sources: z.array(sourceEntrySchema).optional(),
  risk_notes: z.array(z.string().min(1)).max(10).optional(),
});

const scoreResponseSchema = z.object({
  tiers: z.array(tierResultSchema),
  scores: z.array(scoreEntrySchema),
});

type ScoreRequest = z.infer<typeof scoreRequestSchema>;
type ScoreResponse = z.infer<typeof scoreResponseSchema>;
type AgentScoreResponse = ScoreResponsePayload;

type PromptMessage = {
  role: "system" | "user" | "assistant";
  content: string | unknown;
};

type PromptMessages = PromptMessage[];

type EnsureTrue<T extends true> = T;
type _EnsureRequestCompatible = EnsureTrue<
  ScoreRequest extends ScoreRequestPayload ? (ScoreRequestPayload extends ScoreRequest ? true : false) : false
>;
type _EnsureResponseCompatible = EnsureTrue<
  ScoreResponse extends ScoreResponsePayload ? (ScoreResponsePayload extends ScoreResponse ? true : false) : false
>;

type RouteParams = { params: { slug: string } };

function clampScore(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function buildPrompt(projectName: string, projectDescription: string | null, body: ScoreRequest) {
  const tierList = body.options?.tiers?.length ? body.options.tiers : ["S", "A", "B", "C"];
  const useWebSearch = body.options?.useWebSearch === true;
  const strictness = body.options?.strictness ?? "balanced";
  const searchDepth = body.options?.searchDepth ?? "normal";

  const strictnessText =
    strictness === "lenient"
      ? "評価はやや甘めにし、平均的な候補でも B〜A 評価が付きやすいように配慮してください。"
      : strictness === "strict"
      ? "評価はかなり厳しめにし、S ランクはごく少数の明確に優れた候補にのみ与えてください。情報不足や不透明な点は減点要素として扱います。"
      : "評価は標準的な厳しさで行ってください。";

  const depthDescription: Record<SearchDepth, string> = {
    shallow: "簡易検索: 主要な情報源を素早く確認し、要点のみを整理してください。",
    normal: "標準検索: 代表的な情報源を複数確認し、強みと懸念点をバランスよくまとめてください。",
    deep: "詳細検索: 候補ごとに複数の信頼できる情報源を深掘りし、肯定的な情報と否定的な情報の双方を詳しく整理してください。",
  };

  const searchText = useWebSearch
    ? `必要に応じて web_search ツールを使用し、公式サイト・ニュース・調査レポートなど複数の情報源を確認してください。好意的な情報だけでなく、批判的な論点・リスク・否定的な評価も必ず調べ、情報源同士に矛盾がある場合はその旨を理由に含めてください。検索の深さは「${searchDepth}」です。${depthDescription[searchDepth]} 情報が古い・不足している場合はデータ不足としてスコアやTierに反映し、risk_notes に注意書きを追加してください。`
    : "外部のWeb検索は利用せず、一般的に知られている情報や提供データから最良の推定を行ってください。不確実な点は risk_notes に記載し、スコアに慎重さを反映してください。";

  const headerParts = [
    "あなたは企業の労働環境・給与水準・将来性などを評価する専門アナリストです。",
    strictnessText,
    searchText,
    `ティアは ${tierList.join(" > ")} の順序で使用し、各候補に0〜1（小数第3位まで）の総合スコアと主要理由を付けてください。`,
    "結果は指定されたJSON構造のみを返し、前後に説明文やコードブロック（```json など）を付けてはいけません。",
    "top_criteria には特に重要だった指標名を2〜3件挙げ、sources と risk_notes で根拠と懸念点を整理してください。",
  ];
  const header = headerParts.join(" ");

  const schemaInstructionLines = [
    "出力フォーマットは次のJSON構造のみです（余計な文字を追加しない）:",
    "{",
    '  "tiers": [',
    '    {',
    '      "label": "S",',
    '      "items": [',
    '        {',
    '          "id": "A",',
    '          "name": "住友生命",',
    '          "score": 0.85,',
    '          "main_reason": "労働環境と将来性が特に高評価",',
    '          "top_criteria": ["労働環境", "将来性"]',
    '        }',
    '      ]',
    '    }',
    '  ],',
    '  "scores": [',
    '    {',
    '      "id": "A",',
    '      "name": "住友生命",',
    '      "total_score": 0.85,',
    '      "tier": "S",',
    '      "main_reason": "労働環境と将来性が特に高評価",',
    '      "top_criteria": ["労働環境", "将来性"],',
    '      "criteria_breakdown": [',
    '        { "key": "労働環境", "score": 0.90, "weight": 4, "reason": "残業時間の短さ・柔軟な働き方が評価" },',
    '        { "key": "給与水準", "score": 0.80, "weight": 3, "reason": "同業種平均よりやや高い水準" },',
    '        { "key": "将来性", "score": 0.88, "weight": 5, "reason": "デジタル化と新規事業が進展" }',
    '      ],',
    '      "sources": [',
    '        { "url": "https://example.com/...", "title": "企業Aの働き方改革に関する記事", "note": "労働環境の改善事例" }',
    '      ],',
    '      "risk_notes": [',
    '        "長時間労働に関する訴訟が進行中。",',
    '        "直近決算の公開が遅れており最新情報が不足している。"',
    '      ]',
    '    }',
    '  ]',
    "}",
    "",
    "制約:",
    "- 有効なJSONオブジェクトのみを返す（前後に余計な文字を出力しない）",
    "- scores 配列にはすべての候補を1回ずつ含める",
    "- score / total_score / criteria_breakdown[].score は0〜1の数値（小数第3位まで）",
    "- criteria_breakdown は入力された評価指標ごとに日本語で理由をまとめる",
    "- tier は指定された順序を尊重し、候補ごとに1つだけ設定する",
    "- sources には候補ごとに1〜3件のURLのみを含め、title と note は必要に応じて簡潔に記載する",
    "- risk_notes には候補のリスク・懸念点・情報不足を箇条書きでまとめる（該当がなければ空配列）",
    "- ここに記載されていないキーを追加しない",
  ];
  if (useWebSearch) {
    schemaInstructionLines.push("- web_search ツールで得た最新情報のみを根拠として引用する");
  }
  const schemaInstruction = schemaInstructionLines.join("\n");

  const projectContext = {
    project: {
      name: projectName,
      description: projectDescription,
    },
    tierOptions: tierList,
    candidates: body.candidates,
    criteria: body.criteria,
    settings: {
      useWebSearch,
      strictness,
      searchDepth,
    },
  };

  const evaluationInstruction = useWebSearch
    ? "各候補を評価指標に基づいて比較し、web_search ツールで得た情報を根拠にスコアと理由を整理してください。肯定的な情報と否定的な情報の両方を検討し、信頼性が低い・情報が不足している場合は risk_notes に記録し、必要ならスコアやTierを調整してください。参照したURLは必ず sources に含めてください。"
    : "各候補を評価指標に基づいて比較し、提供された情報のみから最良の推定を行ってください。不確実な点は risk_notes に記録し、理由は簡潔な日本語でまとめてください。";

  return [
    { role: "system" as const, content: header },
    { role: "user" as const, content: schemaInstruction },
    { role: "user" as const, content: evaluationInstruction },
    { role: "user" as const, content: JSON.stringify(projectContext) },
  ];
}
function formatMessagesForResponses(messages: PromptMessages) {
  return messages.map((message) => ({
    role: message.role,
    content: [
      {
        type: "input_text" as const,
        text: typeof message.content === "string" ? message.content : JSON.stringify(message.content),
      },
    ],
  }));
}

type ParseScoreResponseFailure =
  | { success: false; reason: "invalid_json"; rawText: string; error: unknown }
  | { success: false; reason: "invalid_shape"; rawText: string; issues: z.ZodIssue[] };

type ParseScoreResponseResult = { success: true; data: ScoreResponse } | ParseScoreResponseFailure;

type OpenAIResponseUsage = {
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
};

type OpenAIOutputContent =
  | { type: "output_text"; text: string }
  | { type: string; [key: string]: unknown };

type OpenAIOutputItem = {
  role?: string;
  content?: OpenAIOutputContent[];
};

type OpenAIResponsePayload = {
  id?: string;
  status?: string;
  usage?: OpenAIResponseUsage;
  output_text?: string;
  output?: OpenAIOutputItem[];
  [key: string]: unknown;
};

function parseAgentJson(raw: string) {
  if (!raw) {
    throw new Error("empty OpenAI output");
  }

  let text = raw.trim();

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  if (!text) {
    throw new Error("OpenAI output missing JSON object");
  }

  return JSON.parse(text);
}

function parseScoreResponsePayload(value: string): ParseScoreResponseResult {
  try {
    const parsed = parseAgentJson(value);
    const schemaResult = scoreResponseSchema.safeParse(parsed);
    if (!schemaResult.success) {
      return {
        success: false,
        reason: "invalid_shape",
        rawText: value,
        issues: schemaResult.error.issues,
      };
    }
    return { success: true, data: schemaResult.data };
  } catch (error) {
    return {
      success: false,
      reason: "invalid_json",
      rawText: value,
      error,
    };
  }
}

type ResponsesPayload = {
  model: string;
  input: ReturnType<typeof formatMessagesForResponses>;
  modalities?: string[];
  max_output_tokens?: number;
  tools?: { type: string; [key: string]: unknown }[];
  tool_choice?: "auto" | "none" | Record<string, unknown>;
};

class OpenAI {
  private readonly apiKey: string;

  constructor(options: { apiKey?: string }) {
    if (!options?.apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    this.apiKey = options.apiKey;
  }

  private async createResponse(payload: ResponsesPayload): Promise<OpenAIResponsePayload> {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();

    if (!response.ok) {
      const error = new Error(`OpenAI response error: ${response.status} ${response.statusText}`);
      (error as any).response = {
        status: response.status,
        data: safeParseJson(rawText),
      };
      throw error;
    }

    if (!rawText) {
      return {};
    }

    try {
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === "object") {
        return parsed as OpenAIResponsePayload;
      }
      throw new Error("Invalid OpenAI response payload");
    } catch (error) {
      const parseError = new Error("Failed to parse OpenAI response payload");
      (parseError as any).cause = error;
      (parseError as any).response = { status: response.status, data: rawText };
      throw parseError;
    }
  }

  responses = {
    create: (payload: ResponsesPayload) => this.createResponse(payload),
  };
}

function safeParseJson(value: string | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function extractOutputText(response: OpenAIResponsePayload): string | null {
  if (typeof response.output_text === "string" && response.output_text.trim().length > 0) {
    return response.output_text.trim();
  }

  if (Array.isArray(response.output)) {
    for (const item of response.output) {
      if (!item?.content) continue;
      for (const content of item.content) {
        if (content && content.type === "output_text" && typeof content.text === "string") {
          const trimmed = content.text.trim();
          if (trimmed) {
            return trimmed;
          }
        }
      }
    }
  }

  return null;
}

function normaliseSources(
  sources: ScoreResponse["scores"][number]["sources"] | undefined,
): NonNullable<ScoreResponsePayload["scores"][number]["sources"]> {
  if (!Array.isArray(sources)) {
    return [];
  }
  const seen = new Set<string>();
  const results: NonNullable<ScoreResponsePayload["scores"][number]["sources"]> = [];
  for (const source of sources) {
    if (!source || typeof source.url !== "string") continue;
    const url = source.url.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const normalised: NonNullable<ScoreResponsePayload["scores"][number]["sources"]>[number] = { url };
    if (typeof source.title === "string" && source.title.trim()) {
      normalised.title = source.title.trim();
    }
    if (typeof source.note === "string" && source.note.trim()) {
      normalised.note = source.note.trim();
    }
    results.push(normalised);
    if (results.length >= 3) break;
  }
  return results;
}

function normaliseResponse(body: ScoreRequest, payload: ScoreResponse): ScoreResponsePayload {
  const candidateMap = new Map(body.candidates.map((candidate) => [candidate.id, candidate]));
  const criteriaByKey = new Map(body.criteria.map((criterion) => [criterion.key, criterion]));
  const criteriaByLabel = new Map(body.criteria.map((criterion) => [criterion.label, criterion]));
  const preferredTiers = payload.tiers.map((tier) => tier.label?.trim()).filter((label): label is string => Boolean(label));
  const fallbackTiers = body.options?.tiers?.map((tier) => tier.trim()).filter((tier) => tier.length > 0) ?? [];
  const tierOrder = preferredTiers.length ? preferredTiers : fallbackTiers;
  const finalTierOrder = tierOrder.length ? tierOrder : ["S", "A", "B", "C"];
  const fallbackTierLabel = finalTierOrder[finalTierOrder.length - 1] ?? "C";
  const createFallbackBreakdown = () =>
    body.criteria.map((criterion) => ({
      key: criterion.label,
      score: 0,
      weight: criterion.weight,
      reason: "十分な情報が不足しています。",
    }));

  const entries = new Map<string, ScoreResponsePayload["scores"][number]>();

  for (const entry of payload.scores) {
    const baseCandidate = candidateMap.get(entry.id);
    const name = entry.name?.trim() || baseCandidate?.name || entry.id;
    const tier = entry.tier?.trim() || finalTierOrder[0] || "S";
    const rawBreakdown = Array.isArray(entry.criteria_breakdown) ? entry.criteria_breakdown : [];
    const breakdown = rawBreakdown
      .map((item) => {
        const key = item.key?.trim();
        const reason = item.reason?.trim();
        if (!key || !reason) return null;
        const matchedCriterion = criteriaByKey.get(key) ?? criteriaByLabel.get(key) ?? null;
        const label = matchedCriterion?.label?.trim() || key;
        const weight = Number.isFinite(item.weight) ? Number(item.weight) : matchedCriterion?.weight ?? 1;
        return {
          key: label,
          score: clampScore(item.score),
          weight: weight,
          reason,
        };
      })
      .filter((value): value is ScoreResponsePayload["scores"][number]["criteria_breakdown"][number] => value !== null);

    const fallbackBreakdown = createFallbackBreakdown();

    const normalisedBreakdown = breakdown.length ? breakdown : fallbackBreakdown;

    const providedTopCriteria = Array.isArray(entry.top_criteria)
      ? Array.from(new Set(entry.top_criteria.map((value) => value?.trim()).filter((value): value is string => Boolean(value))))
      : [];

    const calculatedTopCriteria = normalisedBreakdown
      .slice()
      .sort((a, b) => b.score * b.weight - a.score * a.weight)
      .map((item) => item.key)
      .filter((key) => key.length > 0)
      .slice(0, 3);

    const sources = normaliseSources(entry.sources);
    const riskNotes = Array.isArray(entry.risk_notes)
      ? entry.risk_notes
          .map((note) => (typeof note === "string" ? note.trim() : ""))
          .filter((note) => note.length > 0)
      : [];

    const mainReason = entry.main_reason?.trim() || normalisedBreakdown[0]?.reason || undefined;

    const combinedTopCriteria = providedTopCriteria.length ? providedTopCriteria : calculatedTopCriteria;
    const topCriteria = combinedTopCriteria.slice(0, 3).filter((value) => value.length > 0);

    entries.set(entry.id, {
      id: entry.id,
      name,
      tier,
      total_score: clampScore(entry.total_score),
      main_reason: mainReason,
      top_criteria: topCriteria.length ? topCriteria : undefined,
      criteria_breakdown: normalisedBreakdown,
      ...(sources.length ? { sources } : {}),
      ...(riskNotes.length ? { risk_notes: riskNotes } : {}),
    });
  }

  for (const candidate of body.candidates) {
    if (!entries.has(candidate.id)) {
      const fallbackBreakdown = createFallbackBreakdown();
      const fallbackTopCriteria = fallbackBreakdown
        .slice(0, 3)
        .map((item) => item.key)
        .filter((value) => value.length > 0);
      entries.set(candidate.id, {
        id: candidate.id,
        name: candidate.name,
        tier: fallbackTierLabel,
        total_score: 0,
        main_reason: "十分な情報が不足しているため推定した結果です。",
        top_criteria: fallbackTopCriteria.length ? fallbackTopCriteria : undefined,
        criteria_breakdown: fallbackBreakdown,
        risk_notes: ["十分な情報が不足しているため追加調査が必要です。"],
      });
    }
  }

  const sortedScores = Array.from(entries.values()).sort((a, b) => b.total_score - a.total_score);

  const tierResults: ScoreResponsePayload["tiers"] = [];
  const seenTiers = new Set<string>();
  const pushTier = (label: string) => {
    if (seenTiers.has(label)) return;
    const items = sortedScores
      .filter((entry) => entry.tier === label)
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        score: entry.total_score,
        main_reason: entry.main_reason,
        top_criteria: entry.top_criteria,
      }));
    tierResults.push({ label, items });
    seenTiers.add(label);
  };

  for (const label of finalTierOrder) {
    pushTier(label);
  }

  for (const tier of payload.tiers) {
    if (tier?.label) {
      pushTier(tier.label);
    }
  }

  for (const entry of sortedScores) {
    if (entry?.tier) {
      pushTier(entry.tier);
    }
  }

  return {
    ok: true,
    tiers: tierResults,
    scores: sortedScores,
  };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  console.log("agent/score: handler start", { slug: params.slug });

  try {
    const slug = params.slug;

    if (!slug) {
      return NextResponse.json({ error: "Project slug is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
    }

    const project = await prisma.project.findUnique({ where: { slug } });
    if (!project) {
      return NextResponse.json({ error: `Project not found for slug: ${slug}` }, { status: 404 });
    }

    const rawBody = await req
      .json()
      .then((value) => value)
      .catch(() => null);
    if (!rawBody) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsedBody = scoreRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Invalid request payload", issues: parsedBody.error.issues }, { status: 400 });
    }

    const body = parsedBody.data;
    const useWebSearch = body.options?.useWebSearch === true;
    const strictness = body.options?.strictness ?? "balanced";
    const searchDepth = body.options?.searchDepth ?? "normal";

    if (!body.candidates?.length || !body.criteria?.length) {
      return NextResponse.json({ error: "Candidates and criteria are required" }, { status: 400 });
    }

    console.log("agent/score: request body", body);
    console.info("agent/score: settings", { useWebSearch, strictness, searchDepth });

    const messages = buildPrompt(project.name, project.description, body);
    const formattedInput = formatMessagesForResponses(messages);
    const client = new OpenAI({ apiKey });
    const tools = useWebSearch ? [{ type: "web_search" as const }] : [];
    console.info("agent/score: tools", tools);

    const maxOutputTokens =
      searchDepth === "deep" ? 2500 : searchDepth === "shallow" ? 1400 : 1900;

    try {
      const requestPayload: ResponsesPayload = {
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        input: formattedInput,
        max_output_tokens: maxOutputTokens,
        tool_choice: tools.length ? "auto" : "none",
        ...(tools.length ? { tools } : {}),
      };

      console.info("agent/score: openai request", {
        model: requestPayload.model,
        tool_choice: requestPayload.tool_choice,
        tools: tools.map((tool) => tool.type),
        max_output_tokens: requestPayload.max_output_tokens,
      });

      const response = await client.responses.create(requestPayload);

      console.log("agent/score: openai response", {
        id: response?.id ?? null,
        status: response?.status ?? null,
        usage: response?.usage ?? null,
      });

      const toolEvents = Array.isArray(response?.output)
        ? response.output.flatMap((item) =>
            (item.content ?? [])
              .filter((content) => content?.type && content.type !== "output_text")
              .map((content) => content.type),
          )
        : [];
      console.info("agent/score: response tool events", toolEvents);

      const textOutput = extractOutputText(response) ?? "";

      if (!textOutput) {
        console.error("agent/score: missing output text", response);
        return NextResponse.json(
          { error: "EMPTY_RESPONSE", message: "OpenAI output_text is empty" },
          { status: 500 },
        );
      }

      const parsedResponse = parseScoreResponsePayload(textOutput);
      if (!parsedResponse.success) {
        if (parsedResponse.reason === "invalid_json") {
          console.error("agent/score: parse failure (json)", parsedResponse.error, {
            rawText: parsedResponse.rawText,
          });
          return NextResponse.json(
            { error: "parse_error", message: "Failed to parse AI JSON output" },
            { status: 500 },
          );
        }

        console.error("agent/score: parse failure (shape)", parsedResponse.issues);
        return NextResponse.json(
          {
            error: "invalid_response_shape",
            message: "Failed to validate OpenAI response shape",
            issues: parsedResponse.issues,
          },
          { status: 500 },
        );
      }

      const normalised = normaliseResponse(body, parsedResponse.data);

      return NextResponse.json<AgentScoreResponse>(normalised, { status: 200 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const responseData = (error as any)?.response?.data ?? null;
      console.error("agent/score: fatal openai call", message, responseData);

      return NextResponse.json(
        {
          error: "UPSTREAM_ERROR",
          message,
          openai: responseData,
        },
        { status: 500 },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("agent/score: fatal error", error);
    return NextResponse.json({ error: "agent_score_failed", message }, { status: 500 });
  }
}
