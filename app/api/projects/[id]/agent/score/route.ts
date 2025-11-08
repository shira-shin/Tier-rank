import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { scoreWithAgent } from "@/lib/agent";
import { applyFormulaMetrics } from "@/lib/score";
import type { ScorePayload } from "@/lib/types";
import { applyLimit } from "@/lib/limits";
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
  const parsed = Body.parse(await req.json());

  const session = await getServerSession(authOptions);
  const identifier = session?.user?.id ?? resolveIdentifier(req);

  const scoreLimitResult = await applyLimit(identifier, {
    loggedIn: Boolean(session?.user?.id),
    type: "score",
  });

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
    webLimitResult = await applyLimit(identifier, {
      loggedIn: Boolean(session?.user?.id),
      type: "web",
    });
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

  const agentResult = await scoreWithAgent(payload);
  const final = applyFormulaMetrics(agentResult, parsed.metrics);
  return NextResponse.json(final, {
    headers: {
      "x-ratelimit-score-remaining": String(scoreLimitResult.remaining),
      "x-ratelimit-score-reset": scoreLimitResult.reset.toISOString(),
      ...(webLimitResult
        ? {
            "x-ratelimit-web-remaining": String(webLimitResult.remaining),
            "x-ratelimit-web-reset": webLimitResult.reset.toISOString(),
          }
        : {}),
    },
  });
}
