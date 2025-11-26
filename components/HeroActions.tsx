"use client";

import Link from "next/link";
import { useCallback, type MouseEvent } from "react";

export function HeroActions({ targetId }: { targetId: string }) {
  const handleScrollToTarget = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const element = document.getElementById(targetId);
      if (element) {
        event.preventDefault();
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [targetId],
  );

  return (
    <div className="mt-8 flex flex-wrap gap-4">
      <button
        type="button"
        onClick={handleScrollToTarget}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-6 py-3 text-lg font-semibold text-white shadow-lg transition hover:translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xl">↘</span>
        入力ホームに移動
      </button>
      <Link
        href="#community"
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-6 py-3 text-lg font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:ring-offset-2"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-base">NEW</span>
        投稿フィードを見る
      </Link>
      <Link
        href="/explore"
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-6 py-3 text-lg font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:ring-offset-2"
      >
        みんなのランキングへ →
      </Link>
    </div>
  );
}

export default HeroActions;
