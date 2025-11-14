export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { ScoreRequest as ScoreRequestPayload, ScoreResponse as ScoreResponsePayload, MetricType } from "@/lib/types";

const metricTypeValues = ["numeric", "likert", "boolean", "formula"] as const satisfies readonly MetricType[];

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
    })
    .optional(),
});

const tierItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  score: z.number(),
  reasons: z.string().optional(),
});

const tierResultSchema = z.object({
  label: z.string(),
  items: z.array(tierItemSchema),
});

const scoreEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  score: z.number(),
  tier: z.string(),
  reasons: z.string().optional(),
});

const scoreResponseSchema = z.object({
  tiers: z.array(tierResultSchema),
  scores: z.array(scoreEntrySchema),
});

type ScoreRequest = z.infer<typeof scoreRequestSchema>;
type ScoreResponse = z.infer<typeof scoreResponseSchema>;

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
  const header = `You are an expert analyst that creates tier lists. Respond strictly in JSON matching the provided schema. Use tiers ${tierList.join(", ")}. Score every candidate between 0 and 1 inclusive with at most 3 decimal places. Include a short reason for each candidate.`;

  const schemaInstruction =
    "Return STRICT JSON with shape {\"tiers\":[{\"label\":string,\"items\":[{\"id\":string,\"name\":string,\"score\":number,\"reasons\"?:string}]}],\"scores\":[{\"id\":string,\"name\":string,\"score\":number,\"tier\":string,\"reasons\"?:string}]}";

  const projectContext = {
    project: {
      name: projectName,
      description: projectDescription,
    },
    tierOptions: tierList,
    candidates: body.candidates,
    criteria: body.criteria,
  };

  return [
    { role: "system" as const, content: header },
    { role: "user" as const, content: schemaInstruction },
    {
      role: "user" as const,
      content:
        "Rank the candidates using the criteria. Use every candidate exactly once in scores. Group the tier sections using the requested tier order. Provide concise Japanese reasons (<=160 chars).",
    },
    { role: "user" as const, content: JSON.stringify(projectContext) },
  ];
}

type PromptMessages = ReturnType<typeof buildPrompt>;

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

function safeParseJson(value: string | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseScoreResponsePayload(value: string) {
  try {
    const parsed = JSON.parse(value);
    const schemaResult = scoreResponseSchema.safeParse(parsed);
    if (!schemaResult.success) {
      return { success: false as const, error: schemaResult.error, details: value };
    }
    return { success: true as const, data: schemaResult.data };
  } catch (error) {
    return { success: false as const, error, details: value };
  }
}

type ResponsesPayload = {
  model: string;
  input: ReturnType<typeof formatMessagesForResponses>;
  modalities?: string[];
};

class OpenAI {
  private readonly apiKey: string;

  constructor(options: { apiKey?: string }) {
    if (!options?.apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    this.apiKey = options.apiKey;
  }

  private async createResponse(payload: ResponsesPayload) {
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
      (error as any).response = { status: response.status, data: safeParseJson(rawText) };
      throw error;
    }

    return rawText ? safeParseJson(rawText) : null;
  }

  responses = {
    create: (payload: ResponsesPayload) => this.createResponse(payload),
  };
}

function normaliseResponse(body: ScoreRequest, payload: ScoreResponse): ScoreResponsePayload {
  const candidateMap = new Map(body.candidates.map((candidate) => [candidate.id, candidate]));
  const preferredTiers = payload.tiers.map((tier) => tier.label);
  const fallbackTiers = body.options?.tiers ?? preferredTiers;
  const tierOrder = preferredTiers.length ? preferredTiers : fallbackTiers;

  const entries = new Map<string, ScoreResponse["scores"][number]>();
  for (const entry of payload.scores) {
    const base = candidateMap.get(entry.id);
    const name = entry.name?.trim() || base?.name || entry.id;
    const tier = entry.tier?.trim() || tierOrder[0] || "S";
    const reasons = entry.reasons?.trim() || undefined;
    entries.set(entry.id, {
      id: entry.id,
      name,
      tier,
      score: clampScore(entry.score),
      reasons,
    });
  }

  const finalTierOrder = tierOrder.length ? tierOrder : ["S", "A", "B", "C"];
  const fallbackTierLabel = finalTierOrder[finalTierOrder.length - 1] ?? "C";

  for (const candidate of body.candidates) {
    if (!entries.has(candidate.id)) {
      entries.set(candidate.id, {
        id: candidate.id,
        name: candidate.name,
        tier: fallbackTierLabel,
        score: 0,
        reasons: undefined,
      });
    }
  }

  const sortedScores = Array.from(entries.values()).sort((a, b) => b.score - a.score);

  const seenTiers = new Set<string>();
  const tierResults: ScoreResponse["tiers"] = [];

  const pushTier = (label: string) => {
    if (seenTiers.has(label)) return;
    const items = sortedScores
      .filter((entry) => entry.tier === label)
      .map((entry) => ({ id: entry.id, name: entry.name, score: entry.score, reasons: entry.reasons }));
    tierResults.push({ label, items });
    seenTiers.add(label);
  };

  for (const label of finalTierOrder) {
    pushTier(label);
  }

  for (const tier of payload.tiers) {
    pushTier(tier.label);
  }

  for (const entry of sortedScores) {
    pushTier(entry.tier);
  }

  return {
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

    if (!body.candidates?.length || !body.criteria?.length) {
      return NextResponse.json({ error: "Candidates and criteria are required" }, { status: 400 });
    }

    console.log("agent/score: request body", body);

    const messages = buildPrompt(project.name, project.description, body);
    const formattedInput = formatMessagesForResponses(messages);
    const client = new OpenAI({ apiKey });

    try {
      const response = await client.responses.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        input: formattedInput,
      });

      console.log("agent/score: openai raw response", JSON.stringify(response));

      const textOutput =
        response?.output_text?.trim?.() ||
        response?.output
          ?.flatMap((item: any) => item?.content ?? [])
          .find((content: any) => content?.type === "output_text")?.text ||
        "";

      if (!textOutput) {
        console.error("agent/score: missing output text", response);
        return NextResponse.json(
          { error: "EMPTY_RESPONSE", message: "OpenAI output_text is empty" },
          { status: 500 },
        );
      }

      const parsedResponse = parseScoreResponsePayload(textOutput);
      if (!parsedResponse.success) {
        console.error("agent/score: parse failure", parsedResponse.error, parsedResponse.details);
        return NextResponse.json(
          { error: "PARSE_ERROR", message: "Failed to parse OpenAI response", details: parsedResponse.details },
          { status: 500 },
        );
      }

      const normalised = normaliseResponse(body, parsedResponse.data);

      return NextResponse.json(normalised, { status: 200 });
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
