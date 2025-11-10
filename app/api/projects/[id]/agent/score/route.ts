export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { scoreWithAgent } from "@/lib/agent";
import { applyFormulaMetrics } from "@/lib/score";
import type { ScorePayload } from "@/lib/types";
import { checkScoreLimit, checkWebLimit } from "@/lib/limits";
import { authOptions } from "@/lib/auth";

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

function resolveIdentifier(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const [first] = xff.split(",");
    if (first?.trim()) return first.trim();
  }
  if (req.ip) return req.ip;
  return "anonymous";
}

export async function POST(req: NextRequest) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid_request", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const identifier = session?.user?.id ?? resolveIdentifier(req);
  const loggedIn = Boolean(session?.user?.id);

  const scoreLimitResult = await checkScoreLimit(identifier, { loggedIn });

  if (!scoreLimitResult.success) {
    return NextResponse.json(
      { error: "limit_exceeded", resetAt: scoreLimitResult.reset.toISOString() },
      {
        status: 429,
        headers: {
          "x-ratelimit-score-remaining": "0",
          "x-ratelimit-score-reset": scoreLimitResult.reset.toISOString(),
        },
      },
    );
  }

  let webLimitResult = undefined;
  if (parsed.use_web_search) {
    webLimitResult = await checkWebLimit(identifier, { loggedIn });
    if (!webLimitResult.success) {
      return NextResponse.json(
        { error: "limit_exceeded", resetAt: webLimitResult.reset.toISOString(), kind: "web" },
        {
          status: 429,
          headers: {
            "x-ratelimit-score-remaining": String(scoreLimitResult.remaining),
            "x-ratelimit-score-reset": scoreLimitResult.reset.toISOString(),
            "x-ratelimit-web-remaining": "0",
            "x-ratelimit-web-reset": webLimitResult.reset.toISOString(),
          },
        },
      );
    }
  }

  const payload: ScorePayload = {
    items: parsed.items,
    metrics: parsed.metrics,
    use_web_search: parsed.use_web_search,
  };

  const headers: Record<string, string> = {
    "x-ratelimit-score-remaining": String(scoreLimitResult.remaining),
    "x-ratelimit-score-reset": scoreLimitResult.reset.toISOString(),
  };
  if (webLimitResult) {
    headers["x-ratelimit-web-remaining"] = String(webLimitResult.remaining);
    headers["x-ratelimit-web-reset"] = webLimitResult.reset.toISOString();
  }

  const agentResult = await scoreWithAgent(payload);

  if (agentResult.error) {
    return NextResponse.json(agentResult, { status: 502, headers });
  }

  if (!agentResult.items || agentResult.items.length === 0) {
    return NextResponse.json({ error: "no_items" }, { status: 502, headers });
  }

  const final = applyFormulaMetrics(agentResult, parsed.metrics);
  return NextResponse.json(final, { headers });
}
