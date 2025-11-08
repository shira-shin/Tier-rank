import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scoreWithAgent } from "@/lib/agent";
import { applyFormulaMetrics } from "@/lib/score";
import type { ScorePayload } from "@/lib/types";

const Body = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        meta: z.any().optional(),
      })
    )
    .nonempty(),
  metrics: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(["numeric", "likert", "boolean", "formula"]),
        direction: z.enum(["MAX", "MIN"]).optional(),
        weight: z.number().min(0).optional(),
        target: z.union([z.number(), z.string()]).optional(),
        formula: z.string().optional(),
        normalize: z.enum(["minmax", "zscore", "none"]).optional(),
        params: z.any().optional(),
      })
    )
    .nonempty(),
  use_web_search: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.parse(await req.json());

  const payload: ScorePayload = {
    items: parsed.items,
    metrics: parsed.metrics,
    use_web_search: parsed.use_web_search,
  };

  const agentResult = await scoreWithAgent(payload);
  const final = applyFormulaMetrics(agentResult, parsed.metrics);
  return NextResponse.json(final);
}
