import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  if (process.env.VERCEL_ENV === "preview") {
    const auth = req.headers.get("authorization") || "";
    const expected = "Basic " + Buffer.from(`${process.env.PREVIEW_USER}:${process.env.PREVIEW_PASS}`).toString("base64");
    if (auth !== expected && !req.nextUrl.pathname.startsWith("/api/auth")) {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Preview"' },
      });
    }
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
