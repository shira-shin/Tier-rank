export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const session = await getServerSession(authOptions);

  const ranking = await prisma.ranking.findUnique({
    where: { slug: params.slug },
    include: {
      author: {
        include: {
          profile: true,
        },
      },
      _count: {
        select: { likes: true, bookmarks: true },
      },
    },
  });

  if (!ranking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (ranking.visibility === "PRIVATE" && ranking.authorId !== session?.user?.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let views = ranking.views;
  if (!session || session.user?.id !== ranking.authorId) {
    await prisma.ranking.update({
      where: { id: ranking.id },
      data: { views: { increment: 1 } },
    });
    views += 1;
  }

  let viewerLiked = false;
  let viewerBookmarked = false;
  if (session?.user?.id) {
    const [like, bookmark] = await Promise.all([
      prisma.like.findUnique({
        where: { userId_rankingId: { userId: session.user.id, rankingId: ranking.id } },
        select: { id: true },
      }),
      prisma.bookmark.findUnique({
        where: { userId_rankingId: { userId: session.user.id, rankingId: ranking.id } },
        select: { id: true },
      }),
    ]);
    viewerLiked = Boolean(like);
    viewerBookmarked = Boolean(bookmark);
  }

  return NextResponse.json({
    id: ranking.id,
    slug: ranking.slug,
    title: ranking.title,
    summary: ranking.summary,
    category: ranking.category,
    tags: ranking.tags,
    visibility: ranking.visibility,
    items: ranking.itemsJson,
    metrics: ranking.metricsJson,
    result: ranking.resultJson,
    thumbUrl: ranking.thumbUrl,
    createdAt: ranking.createdAt,
    updatedAt: ranking.updatedAt,
    author: {
      id: ranking.authorId,
      email: ranking.author.email,
      name: ranking.author.name,
      image: ranking.author.image,
      profile: ranking.author.profile,
    },
    counts: {
      views,
      likes: ranking._count.likes,
      bookmarks: ranking._count.bookmarks,
    },
    viewer: {
      liked: viewerLiked,
      bookmarked: viewerBookmarked,
    },
  });
}
