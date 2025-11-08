import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nanoid } from "nanoid";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

const Body = z.object({
  title: z.string().min(1, "タイトルを入力してください"),
  summary: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]),
  items: z.any(),
  metrics: z.any(),
  result: z.any(),
  thumbUrl: z.string().url().optional(),
});

function makeBaseSlug(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "ranking"
  )
    .slice(0, 48)
    .replace(/-+/g, "-");
}

async function ensureProfile(userId: string, fallbackName?: string | null) {
  const existing = await prisma.profile.findUnique({ where: { userId } });
  if (existing) return existing;
  const base = fallbackName?.toLowerCase().replace(/[^a-z0-9]+/g, "") || `user-${userId.slice(0, 6)}`;
  let handle = base || `user-${userId.slice(0, 6)}`;
  let attempt = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const conflict = await prisma.profile.findUnique({ where: { handle } });
    if (!conflict) break;
    attempt += 1;
    handle = `${base}${attempt}`;
  }
  return prisma.profile.create({
    data: {
      userId,
      handle,
      display: fallbackName ?? handle,
    },
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const raw = await request.json();
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 403 });
  }

  await ensureProfile(user.id, session.user.name ?? user.name ?? user.email?.split("@")[0]);

  const baseSlug = makeBaseSlug(parsed.data.title);
  let slug = `${baseSlug}-${nanoid(6).toLowerCase()}`;
  for (let i = 0; i < 3; i += 1) {
    const exists = await prisma.ranking.findUnique({ where: { slug } });
    if (!exists) break;
    slug = `${baseSlug}-${nanoid(6).toLowerCase()}`;
  }

  const tags = Array.from(new Set((parsed.data.tags ?? []).map((tag) => tag.trim()).filter(Boolean))).slice(0, 16);

  const ranking = await prisma.ranking.create({
    data: {
      slug,
      authorId: user.id,
      title: parsed.data.title,
      summary: parsed.data.summary ?? null,
      category: parsed.data.category ?? null,
      tags,
      visibility: parsed.data.visibility,
      itemsJson: parsed.data.items,
      metricsJson: parsed.data.metrics,
      resultJson: parsed.data.result,
      thumbUrl: parsed.data.thumbUrl ?? null,
    },
  });

  return NextResponse.json({ id: ranking.id, slug: ranking.slug });
}
