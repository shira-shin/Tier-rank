import { NextResponse } from "next/server";
import { z } from "zod";

import { scoreWithAgent } from "@/lib/agent";

const bodySchema = z.object({
  items: z.any(),
  metrics: z.any(),
  use_web_search: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: "INVALID_JSON", details: "Failed to parse request body" },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_BODY", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const agentResult = await scoreWithAgent({
    ...parsed.data,
    projectId: params.id,
  });

  return NextResponse.json(agentResult);
}
