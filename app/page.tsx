"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import NavBar from "@/components/NavBar";
import ScoreForm from "@/components/ScoreForm";
import ResultTabs from "@/components/ResultTabs";
import type { AgentResult } from "@/lib/types";

export default function Page() {
  const { data: session, status } = useSession();
  const [res, setRes] = useState<AgentResult | undefined>();

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-6">
        {!session && status !== "loading" && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-sm">
            ログインしていません。Googleでサインインすると、保存や共有などの機能を有効化できます。
          </div>
        )}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-xl bg-white border border-slate-200 p-4">
            <ScoreForm onResult={setRes} />
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-4">
            <h2 className="text-lg font-semibold mb-3">Response</h2>
            {res ? (
              <ResultTabs data={res} />
            ) : (
              <div className="h-[520px] grid place-items-center text-slate-500 text-sm">
                Run the scoring agent to see output.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
