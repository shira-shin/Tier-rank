import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ranking = await prisma.ranking.findUnique({ where: { id: params.id } });
  if (!ranking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const existing = await prisma.like.findUnique({
    where: {
      userId_rankingId: {
        userId: session.user.id,
        rankingId: params.id,
      },
    },
  });

  let liked = true;
  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    liked = false;
  } else {
    await prisma.like.create({
      data: {
        userId: session.user.id,
        rankingId: params.id,
      },
    });
  }

  const count = await prisma.like.count({ where: { rankingId: params.id } });
  return NextResponse.json({ liked, count });
}
