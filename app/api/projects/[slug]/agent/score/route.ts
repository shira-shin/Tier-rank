export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { ScoreRequest as ScoreRequestPayload, ScoreResponse as ScoreResponsePayload } from "@/lib/types";

const candidateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

const criterionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  direction: z.enum(["up", "down"]),
  weight: z.number().min(0),
  type: z.string().optional(),
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
    { role: "system", content: header },
    { role: "user", content: schemaInstruction },
    {
      role: "user",
      content:
        "Rank the candidates using the criteria. Use every candidate exactly once in scores. Group the tier sections using the requested tier order. Provide concise Japanese reasons (<=160 chars).",
    },
    { role: "user", content: JSON.stringify(projectContext) },
  ];
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
  try {
    const slug = params.slug;

    if (!slug) {
      return NextResponse.json({ error: "Project slug is required" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
    }

    const project = await prisma.project.findUnique({ where: { slug } });
    if (!project) {
      return NextResponse.json({ error: `Project not found for slug: ${slug}` }, { status: 404 });
    }

    let body: ScoreRequest;
    try {
      const json = await req.json();
      body = scoreRequestSchema.parse(json);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid request payload", issues: error.issues }, { status: 400 });
      }
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.candidates?.length || !body.criteria?.length) {
      return NextResponse.json({ error: "Candidates and criteria are required" }, { status: 400 });
    }

    const messages = buildPrompt(project.name, project.description, body);

    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          modalities: ["text"],
          input: messages,
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: "Failed to call OpenAI", details: message }, { status: 500 });
    }

    const rawText = await response.text();

    if (!response.ok) {
      return NextResponse.json({ error: "OpenAI response error", details: rawText || response.statusText }, { status: 500 });
    }

    let parsed: unknown;
    try {
      parsed = rawText ? JSON.parse(rawText) : undefined;
    } catch {
      parsed = undefined;
    }

    const textOutput =
      (parsed as any)?.output?.[0]?.content?.[0]?.text ?? (parsed as any)?.output_text ?? (typeof rawText === "string" ? rawText : "");

    if (!textOutput) {
      return NextResponse.json({ error: "Empty response from OpenAI" }, { status: 500 });
    }

    let structured: ScoreResponse;
    try {
      const json = JSON.parse(textOutput);
      structured = scoreResponseSchema.parse(json);
    } catch (error) {
      return NextResponse.json({ error: "Failed to parse OpenAI response", details: textOutput, issues: error }, { status: 500 });
    }

    const normalised = normaliseResponse(body, structured);

    return NextResponse.json(normalised);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("/api/projects/[slug]/agent/score error", error);
    return NextResponse.json({ error: "Internal Server Error", detail }, { status: 500 });
  }
}
