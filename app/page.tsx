import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "./api/auth/[...nextauth]/route";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <main>
      <h1>Tier Rank</h1>
      <p>Minimal Next.js 14 scaffold.</p>
      {session ? (
        <p>ログイン中</p>
      ) : (
        <Link href="/api/auth/signin">Sign in with Google</Link>
      )}
    </main>
  );
}
