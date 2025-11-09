export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function POST(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ranking = await prisma.ranking.findUnique({
    where: { slug: params.slug },
    select: { id: true },
  });
  if (!ranking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const existing = await prisma.bookmark.findUnique({
    where: {
      userId_rankingId: {
        userId: session.user.id,
        rankingId: ranking.id,
      },
    },
  });

  let bookmarked = true;
  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
    bookmarked = false;
  } else {
    await prisma.bookmark.create({
      data: {
        userId: session.user.id,
        rankingId: ranking.id,
      },
    });
  }

  const count = await prisma.bookmark.count({ where: { rankingId: ranking.id } });
  return NextResponse.json({ bookmarked, count });
}
