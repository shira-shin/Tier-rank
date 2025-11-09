export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getRedis } from "@/lib/upstash";

const Body = z.object({
  reason: z.string().min(1).max(500),
});

export async function POST(
  request: Request,
  { params }: { params: { slug: string } },
) {
  const session = await getServerSession(authOptions);
  const payload = Body.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const ranking = await prisma.ranking.findUnique({
    where: { slug: params.slug },
    select: { id: true, slug: true },
  });
  if (!ranking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const entry = {
    rankingId: ranking.id,
    rankingSlug: ranking.slug,
    reason: payload.data.reason,
    reportedBy: session?.user?.id ?? null,
    reportedAt: new Date().toISOString(),
  };

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  await redis.lpush("reports:rankings", JSON.stringify(entry));
  return NextResponse.json({ ok: true });
}
