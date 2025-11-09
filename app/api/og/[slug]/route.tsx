import { ImageResponse } from "next/og";

export const runtime = "edge";

type Params = { params: { slug: string } };

export async function GET(req: Request, { params }: Params) {
  const url = new URL(req.url);
  const title =
    url.searchParams.get("title") ??
    decodeURIComponent(params.slug ?? "").replace(/-/g, " ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(135deg,#0f172a,#312e81)",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: 48, opacity: 0.8 }}>Tier Rank</div>
        <div style={{ fontSize: 84, fontWeight: 800, marginTop: 12 }}>
          {title}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
