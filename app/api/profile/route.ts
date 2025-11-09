export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

const Body = z.object({
  handle: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, "英数字またはアンダースコアのみ利用できます"),
  display: z.string().min(1).max(64),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
  links: z
    .object({
      twitter: z.string().url().optional(),
      github: z.string().url().optional(),
      site: z.string().url().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.profile.findUnique({ where: { handle: parsed.data.handle } });
  if (existing && existing.userId !== session.user.id) {
    return NextResponse.json({ error: "handle_taken" }, { status: 409 });
  }

  const rawLinks =
    parsed.data.links && Object.keys(parsed.data.links).length > 0
      ? parsed.data.links
      : null;

  // links は JSON 型。undefined や null の場合は Prisma.DbNull（DBのNULL）にする。
  // 「JSON の null」を入れたい場合は Prisma.JsonNull を使う。
  const links =
    rawLinks === undefined || rawLinks === null
      ? Prisma.DbNull
      : (rawLinks as Prisma.InputJsonValue);

  const profile = await prisma.profile.upsert({
    where: { userId: session.user.id },
    update: {
      handle: parsed.data.handle,
      display: parsed.data.display,
      bio: parsed.data.bio ?? null,
      avatarUrl: parsed.data.avatarUrl ?? null,
      links, // ← 上で Prisma.DbNull / JsonNull に正規化済み
    },
    create: {
      userId: session.user.id,
      handle: parsed.data.handle,
      display: parsed.data.display,
      bio: parsed.data.bio ?? null,
      avatarUrl: parsed.data.avatarUrl ?? null,
      links,
    },
  });

  return NextResponse.json(profile);
}
