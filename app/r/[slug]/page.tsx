import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import RankingPublicView from "@/components/RankingPublicView";
import type { AgentResult, ItemInput, MetricInput } from "@/lib/types";

export const revalidate = 0;

export default async function RankingPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  const ranking = await prisma.ranking.findUnique({
    where: { slug: params.slug },
    include: {
      author: {
        include: { profile: true },
      },
      _count: { select: { likes: true, bookmarks: true } },
    },
  });

  if (!ranking) {
    notFound();
  }

  if (ranking.visibility === "PRIVATE" && ranking.authorId !== session?.user?.id) {
    notFound();
  }

  let views = ranking.views;
  if (!session || session.user?.id !== ranking.authorId) {
    await prisma.ranking.update({
      where: { id: ranking.id },
      data: { views: { increment: 1 } },
    });
    views += 1;
  }

  let liked = false;
  let bookmarked = false;
  if (session?.user?.id) {
    const [like, bookmark] = await Promise.all([
      prisma.like.findUnique({
        where: {
          userId_rankingId: { userId: session.user.id, rankingId: ranking.id },
        },
        select: { id: true },
      }),
      prisma.bookmark.findUnique({
        where: {
          userId_rankingId: { userId: session.user.id, rankingId: ranking.id },
        },
        select: { id: true },
      }),
    ]);
    liked = Boolean(like);
    bookmarked = Boolean(bookmark);
  }

  return (
    <RankingPublicView
      data={{
        id: ranking.id,
        slug: ranking.slug,
        title: ranking.title,
        summary: ranking.summary,
        category: ranking.category,
        tags: ranking.tags,
        items: ranking.itemsJson as ItemInput[],
        metrics: ranking.metricsJson as MetricInput[],
        result: ranking.resultJson as AgentResult,
        createdAt: ranking.createdAt.toISOString(),
        author: {
          id: ranking.authorId,
          name: ranking.author.name,
          email: ranking.author.email,
          image: ranking.author.image,
          profile: ranking.author.profile,
        },
        counts: {
          views,
          likes: ranking._count.likes,
          bookmarks: ranking._count.bookmarks,
        },
        viewer: { liked, bookmarked },
      }}
    />
  );
}
