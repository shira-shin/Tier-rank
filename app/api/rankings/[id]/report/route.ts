import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { redis } from "@/lib/upstash";

const Body = z.object({
  reason: z.string().min(1).max(500),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const payload = Body.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const entry = {
    rankingId: params.id,
    reason: payload.data.reason,
    reportedBy: session?.user?.id ?? null,
    reportedAt: new Date().toISOString(),
  };

  await redis.lpush("reports:rankings", JSON.stringify(entry));
  return NextResponse.json({ ok: true });
}
