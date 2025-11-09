export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sort = searchParams.get("sort") ?? "new";
  const tag = searchParams.get("tag") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const limitParam = Number.parseInt(searchParams.get("limit") ?? "24", 10);
  const take = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 60) : 24;

  const where: Record<string, unknown> = { visibility: "PUBLIC" };
  if (tag) {
    where.tags = { has: tag };
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { summary: { contains: q, mode: "insensitive" } },
      { tags: { has: q } },
    ];
  }

  let orderBy: any = { createdAt: "desc" };
  if (sort === "top") {
    orderBy = [{ likes: { _count: "desc" } }, { createdAt: "desc" }];
  } else if (sort === "hot" || sort === "trending") {
    orderBy = [{ views: "desc" }, { updatedAt: "desc" }];
  }

  const rankings = await prisma.ranking.findMany({
    where,
    take,
    orderBy,
    include: {
      author: {
        include: { profile: true },
      },
      _count: { select: { likes: true, bookmarks: true } },
    },
  });

  return NextResponse.json(
    rankings.map((ranking) => ({
      id: ranking.id,
      slug: ranking.slug,
      title: ranking.title,
      summary: ranking.summary,
      category: ranking.category,
      tags: ranking.tags,
      thumbUrl: ranking.thumbUrl,
      createdAt: ranking.createdAt,
      counts: ranking._count,
      views: ranking.views,
      author: {
        id: ranking.authorId,
        name: ranking.author.name,
        image: ranking.author.image,
        profile: ranking.author.profile,
      },
    })),
  );
}
