import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scoreWithAgent } from "@/lib/agent";

const Body = z.object({
  items: z.array(z.object({ id: z.string(), name: z.string(), meta: z.any().optional() })),
  metrics: z.array(z.object({
    name: z.string(),
    type: z.enum(["numeric","boolean","likert"]),
    direction: z.enum(["MAX","MIN","TARGET","LOG"]),
    weight: z.number().min(0),
    threshold: z.number().optional(),
    params: z.any().optional()
  })),
  use_web_search: z.boolean().optional()
});

export async function POST(req: NextRequest) {
  const body = Body.parse(await req.json());
  const out = await scoreWithAgent(body);
  return NextResponse.json(out);
}
