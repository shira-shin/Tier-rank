import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scoreWithAgent, type ScorePayload } from "@/lib/agent";

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
        type: z.enum(["numeric", "boolean", "likert"]),
        direction: z.enum(["MAX", "MIN", "TARGET", "LOG"]),
        weight: z.number().min(0),
        threshold: z.number().optional(),
        params: z.any().optional(),
      })
    )
    .nonempty(),
  use_web_search: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const data = Body.parse(await req.json());

  const payload: ScorePayload = {
    items: data.items,
    metrics: data.metrics,
    use_web_search: data.use_web_search,
  };

  const agentResult = await scoreWithAgent(payload);
  return NextResponse.json(agentResult);
}
