import { ImageResponse } from "@vercel/og";
import prisma from "@/lib/prisma";

export const runtime = "edge";

function formatTitle(title: string) {
  if (title.length <= 42) return title;
  return `${title.slice(0, 39)}...`;
}

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const ranking = await prisma.ranking.findUnique({
    where: { slug: params.slug },
    include: { author: { include: { profile: true } } },
  });

  if (!ranking) {
    return new ImageResponse(
      (
        <div
          style={{
            background: "linear-gradient(135deg,#0f172a,#312e81)",
            display: "flex",
            height: "100%",
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 48,
            fontWeight: 700,
          }}
        >
          Tier Rank
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  const badges = ranking.resultJson?.items?.slice?.(0, 4) ?? [];

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px",
          background: "radial-gradient(circle at 20% 20%, #a855f7, transparent 55%), radial-gradient(circle at 80% 0%, #22d3ee, transparent 45%), linear-gradient(135deg, rgba(15,23,42,0.92), rgba(15,23,42,0.85))",
          color: "white",
          fontFamily: "'Noto Sans JP', sans-serif",
        }}
      >
        <div style={{ fontSize: 28, textTransform: "uppercase", opacity: 0.75 }}>Tier Rank</div>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>{formatTitle(ranking.title)}</div>
        <div style={{ display: "flex", gap: "16px", marginTop: "32px" }}>
          {badges.map((item: any, index: number) => (
            <div
              key={item.id ?? index}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "18px 24px",
                borderRadius: "24px",
                backdropFilter: "blur(12px)",
                background: "rgba(15, 23, 42, 0.45)",
                border: "1px solid rgba(129, 140, 248, 0.4)",
                minWidth: "160px",
              }}
            >
              <div style={{ fontSize: 14, opacity: 0.7 }}>Tier</div>
              <div style={{ fontSize: 36, fontWeight: 700 }}>{item.tier ?? "-"}</div>
              <div style={{ fontSize: 18, marginTop: 12 }}>{item.id}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "48px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{ranking.author.profile?.display ?? ranking.author.name ?? "Creator"}</div>
            <div style={{ fontSize: 18, opacity: 0.7 }}>tier-rank.vercel.app/r/{ranking.slug}</div>
          </div>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: "24px",
              background: "linear-gradient(135deg,#38bdf8,#22c55e)",
            }}
          />
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
