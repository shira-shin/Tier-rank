"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export default function NavBar() {
  const { data: session, status } = useSession();
  return (
    <header className="sticky top-0 z-10 bg-white/70 backdrop-blur border-b border-slate-200">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <div className="text-2xl font-bold tracking-tight">ティア・ランク</div>
        <div className="flex items-center gap-3">
          {status === "loading" && <span className="text-sm text-slate-500">ログイン状態を確認中…</span>}
          {status !== "loading" && !session && (
            <button
              onClick={() => signIn("google")}
              className="rounded-lg px-3 py-1.5 text-white bg-blue-600 hover:bg-blue-700 text-sm"
            >
              Googleでサインイン
            </button>
          )}
          {session && (
            <div className="flex items-center gap-3">
              <img
                src={session.user?.image ?? "https://www.gravatar.com/avatar?d=mp"}
                alt=""
                className="h-8 w-8 rounded-full"
              />
              <div className="text-sm">
                <div className="font-medium">{session.user?.name ?? "Signed in"}</div>
                <div className="text-slate-500">{session.user?.email}</div>
              </div>
              <button
                onClick={() => signOut()}
                className="rounded-lg px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-sm"
              >
                サインアウト
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
