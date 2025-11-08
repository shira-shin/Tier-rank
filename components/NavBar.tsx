"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useTheme } from "@/lib/useTheme";

export default function NavBar() {
  const { data: session, status } = useSession();
  const { theme, toggle, isReady } = useTheme();
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="text-2xl font-bold tracking-tight">ティア・ランク</div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            disabled={!isReady}
            className="flex items-center gap-2 rounded-full border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 px-3 py-1.5 text-sm shadow-sm transition hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60"
          >
            <span aria-hidden>{theme === "dark" ? "🌙" : "☀️"}</span>
            <span>{theme === "dark" ? "ライト" : "ダーク"}モード</span>
          </button>
          {status === "loading" && <span className="text-sm text-slate-500">ログイン状態を確認中…</span>}
          {status !== "loading" && !session && (
            <button
              onClick={() => signIn("google")}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white shadow-sm transition hover:bg-blue-700"
            >
              Googleでサインイン
            </button>
          )}
          {session && (
            <div className="flex items-center gap-3">
              <img
                src={session.user?.image ?? "https://www.gravatar.com/avatar?d=mp"}
                alt=""
                className="h-8 w-8 rounded-full border border-white/20"
              />
              <div className="text-sm">
                <div className="font-medium">{session.user?.name ?? "Signed in"}</div>
                <div className="text-text-muted">{session.user?.email}</div>
              </div>
              <button
                onClick={() => signOut()}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
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
