export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

// Next.js Route Module の要件に合わせ、GET/POST 以外は export しない
export { handler as GET, handler as POST };
